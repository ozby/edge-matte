import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

/** @typedef {{ label: string; pattern: RegExp }} WorkflowExpectation */

export const PRODUCTION_DOMAIN = "edge-matte.ozby.dev";

export const PR_CI_WORKFLOW = ".github/workflows/ci.webpresso.yml";

export const PRODUCTION_DEPLOY_WORKFLOW = ".github/workflows/deploy.production.yml";

/** PR CI must prove deployability without mutating production (IR-1 / blueprint task 5). */
export const PR_CI_REQUIRED_RUNS = /** @type {WorkflowExpectation[]} */ ([
  { label: "frozen install", pattern: /pnpm install(?: --frozen-lockfile)?/u },
  { label: "format check", pattern: /format:check|vp fmt --check/u },
  { label: "lint", pattern: /pnpm run lint/u },
  { label: "typecheck", pattern: /pnpm run (?:typecheck|check-types)/u },
  { label: "test", pattern: /pnpm run test/u },
  { label: "build", pattern: /pnpm run build/u },
  {
    label: "deploy credential verify (dry-run or full probe)",
    pattern: /verify-cloudflare-deploy-creds|deploy --dry-run|deploy:dry-run/u,
  },
]);

/** Main deploy must serialize production releases and verify smoke (IR-1 / blueprint tasks 6–7). */
export const PRODUCTION_DEPLOY_REQUIREMENTS = /** @type {WorkflowExpectation[]} */ ([
  { label: "main branch trigger", pattern: /branches:\s*\[[^\]]*main/u },
  { label: "deploy concurrency", pattern: /concurrency:/u },
  { label: "wrangler deploy", pattern: /wrangler deploy --env production/u },
  { label: "production domain target", pattern: /edge-matte\.ozby\.dev/u },
  { label: "post-deploy /health smoke", pattern: /wait-for-http\.sh.*\/health|\/health/u },
  {
    label: "post-deploy root smoke",
    pattern: /wait-for-http\.sh|edge-matte\.ozby\.dev\/["'\s]|curl[^\n]*\/["'\s]/u,
  },
  { label: "verify paths policy", pattern: /verify:paths/u },
  { label: "production-smoke e2e suite", pattern: /production-smoke/u },
  {
    label: "doppler deploy credential injection",
    pattern: /dopplerhq\/secrets-fetch-action|DOPPLER_SERVICE_TOKEN|DOPPLER_TOKEN/u,
  },
  {
    label: "pre-deploy credential verify",
    pattern: /verify-cloudflare-deploy-creds/u,
  },
]);

/**
 * @param {string} repoRoot
 * @param {string} relativePath
 */
export function readWorkflow(repoRoot, relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    return { exists: false, absolutePath, contents: "" };
  }
  return {
    exists: true,
    absolutePath,
    contents: readFileSync(absolutePath, "utf8"),
  };
}

/**
 * Collect `- run:` shell lines from a GitHub Actions workflow file.
 *
 * @param {string} contents
 */
export function collectWorkflowRunSteps(contents) {
  return contents
    .split("\n")
    .filter((line) => /^\s*-\s+run:/u.test(line))
    .map((line) => line.replace(/^\s*-\s+run:\s*/u, "").trim());
}

/**
 * @param {string} contents
 * @param {WorkflowExpectation[]} expectations
 */
export function findMissingExpectations(contents, expectations) {
  return expectations.filter(({ pattern }) => !pattern.test(contents));
}

/**
 * @param {string} repoRoot
 */
export function listWorkflowFiles(repoRoot) {
  const workflowsDir = resolve(repoRoot, ".github/workflows");
  if (!existsSync(workflowsDir)) {
    return [];
  }
  return readdirSync(workflowsDir)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort()
    .map((name) => join(".github/workflows", name));
}

/**
 * @param {WorkflowExpectation[]} missing
 * @param {string} workflowPath
 */
export function formatMissingExpectations(missing, workflowPath) {
  if (missing.length === 0) {
    return "";
  }
  const labels = missing.map(({ label }) => `- ${label}`).join("\n");
  return `${workflowPath} is missing IR-1 release expectations:\n${labels}`;
}
