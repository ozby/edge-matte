import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { findRepoRoot } from "./deploy-runner.ts";

type DeployRequest = {
  lane: string;
  dryRun: boolean;
  mode?: "deploy" | "destroy";
  releaseVersion?: string;
};

type DeployStep =
  | {
      kind: "managed-tool";
      id: string;
      label: string;
      tool: string;
      args: string[];
      cwd: string;
      runtimeProfile?: string;
      stage?: "preview_health" | "health" | "homepage" | "production_smoke" | "production_journey";
      env?: Record<string, string>;
    }
  | {
      kind: "command";
      id: string;
      label: string;
      command: string;
      args: string[];
      cwd: string;
      runtimeProfile?: string;
      stage?: "preview_health" | "health" | "homepage" | "production_smoke" | "production_journey";
      env?: Record<string, string>;
    }
  | {
      kind: "http-check";
      id: string;
      label: string;
      url: string;
      cwd: string;
      runtimeProfile?: string;
      stage: "preview_health" | "health" | "homepage" | "production_smoke" | "production_journey";
      retries?: number;
      intervalMs?: number;
      timeoutMs?: number;
      headers?: Record<string, string>;
    };

type DeployPlan = {
  schemaVersion: 1;
  lane: string;
  provider: string;
  requiredCredentials: string[];
  releaseVersion?: string;
  steps: DeployStep[];
};

type DeployAdapter = {
  createPlan(request: DeployRequest): DeployPlan;
};

const deployDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = findRepoRoot(deployDir);
const PRODUCTION_URL = "https://edge-matte.ozby.dev";
const ACCESS_HEADERS = {
  "CF-Access-Client-Id": "${CF_ACCESS_CLIENT_ID}",
  "CF-Access-Client-Secret": "${CF_ACCESS_CLIENT_SECRET}",
};

function toPreviewScriptLane(lane: string): string {
  if (lane === "preview_main") {
    return "preview-main";
  }
  const previewPrMatch = lane.match(/^preview_pr_(\d+)$/u);
  if (previewPrMatch) {
    return `preview-pr-${previewPrMatch[1]}`;
  }
  throw new Error(`Unsupported deploy lane: ${lane}`);
}

export const webpressoDeployAdapter: DeployAdapter = {
  createPlan(request): DeployPlan {
    const lane = request.lane;
    const dryRun = request.dryRun;
    const isProductionLane = lane === "prd";

    if (dryRun) {
      if (!isProductionLane) {
        const previewScriptLane = toPreviewScriptLane(lane);
        return {
          schemaVersion: 1,
          lane,
          provider: "cloudflare",
          requiredCredentials: [],
          steps: [
            {
              kind: "command",
              id: "edge-matte-preview-dry-run",
              label: `Validate edge-matte ${lane} preview deploy without publishing`,
              command: "bun",
              args: [
                resolve(deployDir, "deploy-preview.ts"),
                "--lane",
                previewScriptLane,
                "--dry-run",
              ],
              cwd: repoRoot,
              runtimeProfile: "none",
            },
          ],
        };
      }

      return {
        schemaVersion: 1,
        lane,
        provider: "cloudflare",
        requiredCredentials: [],
        steps: [
          {
            kind: "command",
            id: "wrangler-dry-run",
            label: "Validate Cloudflare Worker deploy without publishing",
            command: "vp",
            args: [
              "exec",
              "--filter",
              "@edge-matte/worker",
              "--",
              "wrangler",
              "deploy",
              "--dry-run",
              "--config",
              "wrangler.toml",
              "--env",
              "production",
            ],
            cwd: repoRoot,
            runtimeProfile: "none",
          },
        ],
      };
    }

    if (!isProductionLane) {
      const previewScriptLane = toPreviewScriptLane(lane);
      return {
        schemaVersion: 1,
        lane,
        provider: "cloudflare",
        requiredCredentials: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID"],
        steps: [
          {
            kind: "command",
            id: "edge-matte-deploy",
            label:
              request.mode === "destroy"
                ? `Run edge-matte ${lane} destroy script`
                : `Run edge-matte ${lane} deploy script`,
            command: "bun",
            args: [
              resolve(deployDir, "deploy-preview.ts"),
              "--lane",
              previewScriptLane,
              ...(request.mode === "destroy" ? ["--destroy"] : []),
            ],
            cwd: repoRoot,
            runtimeProfile: "secrets-only",
          },
        ],
      };
    }

    return {
      schemaVersion: 1,
      lane,
      provider: "cloudflare",
      requiredCredentials: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
      releaseVersion: request.releaseVersion,
      steps: [
        {
          kind: "command",
          id: "edge-matte-deploy",
          label: `Run edge-matte ${lane} deploy script`,
          command: "bun",
          args: [resolve(deployDir, "deploy-production.ts"), "--skip-smoke"],
          cwd: repoRoot,
          runtimeProfile: "secrets-only",
        },
        {
          kind: "http-check",
          id: "production-health",
          label: "Verify production /health",
          stage: "health",
          url: `${PRODUCTION_URL}/health`,
          headers: ACCESS_HEADERS,
          cwd: repoRoot,
          runtimeProfile: "secrets-only",
          retries: 24,
          intervalMs: 5_000,
          timeoutMs: 10_000,
        },
        {
          kind: "http-check",
          id: "production-homepage",
          label: "Verify production homepage",
          stage: "homepage",
          url: `${PRODUCTION_URL}/`,
          headers: ACCESS_HEADERS,
          cwd: repoRoot,
          runtimeProfile: "secrets-only",
          retries: 12,
          intervalMs: 5_000,
          timeoutMs: 10_000,
        },
        {
          kind: "command",
          id: "production-smoke",
          label: "Run production-smoke suite",
          stage: "production_smoke",
          command: "pnpm",
          args: ["e2e", "--", "--suite", "production-smoke"],
          cwd: repoRoot,
          runtimeProfile: "secrets-only",
          env: { E2E_RUN_PRODUCTION: "1" },
        },
        {
          kind: "command",
          id: "production-journey",
          label: "Run production-journey suite",
          stage: "production_journey",
          command: "pnpm",
          args: ["e2e", "--", "--suite", "production-journey"],
          cwd: repoRoot,
          runtimeProfile: "secrets-only",
          env: { E2E_RUN_PRODUCTION: "1" },
        },
      ],
    };
  },
};

export default webpressoDeployAdapter;
