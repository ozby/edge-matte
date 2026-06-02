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

export const webpressoDeployAdapter: DeployAdapter = {
  createPlan(request): DeployPlan {
    const lane = request.lane;
    const dryRun = request.dryRun;
    if (dryRun) {
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
            args: ["deploy", "--dry-run", "--env", lane === "prd" ? "production" : "preview-main"],
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
          args: [resolve(scriptsDir, lane === "prd" ? "deploy-production.ts" : "deploy-preview.ts")],
          cwd: repoRoot,
        },
      ],
    };
  },
};

export default webpressoDeployAdapter;
