import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

type DeployRequest = {
  lane: string;
  dryRun: boolean;
};

type DeployStep =
  | { kind: "managed-tool"; id: string; label: string; tool: string; args: string[]; cwd: string }
  | { kind: "command"; id: string; label: string; command: string; args: string[]; cwd: string };

type DeployPlan = {
  schemaVersion: 1;
  lane: string;
  provider: string;
  requiredCredentials: string[];
  steps: DeployStep[];
};

type DeployAdapter = {
  createPlan(request: DeployRequest): DeployPlan;
};

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptsDir, "..");

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
                resolve(scriptsDir, "deploy-preview.ts"),
                "--lane",
                previewScriptLane,
                "--dry-run",
              ],
              cwd: repoRoot,
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
            kind: "managed-tool",
            id: "wrangler-dry-run",
            label: "Validate Cloudflare Worker deploy without publishing",
            tool: "wrangler",
            args: ["deploy", "--dry-run", "--env", "production"],
            cwd: repoRoot,
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
        requiredCredentials: ["CLOUDFLARE_API_TOKEN"],
        steps: [
          {
            kind: "command",
            id: "edge-matte-deploy",
            label: `Run edge-matte ${lane} deploy script`,
            command: "bun",
            args: [resolve(scriptsDir, "deploy-preview.ts"), "--lane", previewScriptLane],
            cwd: repoRoot,
          },
        ],
      };
    }

    return {
      schemaVersion: 1,
      lane,
      provider: "cloudflare",
      requiredCredentials: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
      steps: [
        {
          kind: "command",
          id: "edge-matte-deploy",
          label: `Run edge-matte ${lane} deploy script`,
          command: "bun",
          args: [resolve(scriptsDir, "deploy-production.ts")],
          cwd: repoRoot,
        },
      ],
    };
  },
};

export default webpressoDeployAdapter;
