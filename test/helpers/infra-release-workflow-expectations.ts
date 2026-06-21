import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

export interface WorkflowExpectation {
  label: string;
  pattern: RegExp;
}

export const PRODUCTION_DOMAIN = "edge-matte.ozby.dev";

export const PR_CI_WORKFLOW = ".github/workflows/ci.yml";

export const PRODUCTION_DEPLOY_WORKFLOW = ".github/workflows/deploy-production.yml";
export const PREVIEW_DEPLOY_WORKFLOW = ".github/workflows/deploy-preview.yml";
export const WAIT_FOR_HTTP_SCRIPT = "infra/src/deploy/wait-for-http.sh";
export const DEPLOY_PRODUCTION_SCRIPT = "infra/src/deploy/deploy-production.ts";
export const DEPLOY_PREVIEW_SCRIPT = "infra/src/deploy/deploy-preview.ts";

export const CODEOWNERS_WORKFLOW_GOVERNANCE_PATH = ".github/CODEOWNERS";

export const FULL_SHA_ACTION_REFERENCE_PATTERN = /^[^@\s]+@[0-9a-f]{40}$/u;

/** PR CI must prove deployability without mutating production (IR-1 / blueprint task 5). */
export const PR_CI_REQUIRED_RUNS: WorkflowExpectation[] = [
  {
    label: "frozen install",
    pattern: /vp install --frozen-lockfile/u,
  },
  { label: "format check", pattern: /format:check|vp fmt --check/u },
  { label: "lint", pattern: /vp run lint/u },
  { label: "typecheck", pattern: /vp run (?:typecheck|check-types)/u },
  { label: "docs frontmatter audit", pattern: /wp audit docs-frontmatter/u },
  { label: "absolute path policy", pattern: /wp audit absolute-path-policy --root \./u },
  { label: "secret quarantine audit", pattern: /audit:secret-provider-quarantine/u },
];

/** Preview deploy must mutate only preview Workers for main and pull requests. */
export const PREVIEW_DEPLOY_REQUIREMENTS: WorkflowExpectation[] = [
  { label: "main preview trigger", pattern: /branches:\s*\[[^\]]*main/u },
  { label: "pull request preview trigger", pattern: /^\s*pull_request:/mu },
  { label: "preview concurrency", pattern: /edge-matte-preview-/u },
  { label: "preview deploy script", pattern: /deploy-preview/u },
  { label: "preview-main lane", pattern: /preview-main/u },
  { label: "preview-pr lane", pattern: /preview-pr/u },
  { label: "closed PR cleanup", pattern: /--destroy/u },
  { label: "repo-owned preview secret profile", pattern: /secret_profile:\s*preview/u },
  {
    label: "preview token secret mapping",
    pattern: /ci_secret_provider_token:\s*\$\{\{ secrets\.CI_SECRET_PROVIDER_TOKEN_PREVIEW \}\}/u,
  },
];

/** Production deploy must serialize releases and verify smoke (IR-1 / blueprint tasks 6–7). */
export const PRODUCTION_DEPLOY_REQUIREMENTS: WorkflowExpectation[] = [
  { label: "manual release dispatch", pattern: /workflow_dispatch:/u },
  { label: "manual release version input", pattern: /release_version/u },
  { label: "deploy concurrency", pattern: /concurrency:/u },
  {
    label: "frozen install",
    pattern: /vp install --frozen-lockfile/u,
  },
  {
    label: "shared reusable production workflow",
    pattern: /uses:\s*webpresso\/github-actions\/.github\/workflows\/cloudflare-production\.yml@/u,
  },
  {
    label: "deploy contract verify",
    pattern: /vp run verify:deploy-contract|wp audit cloudflare-deploy-contract/u,
  },
  {
    label: "production release metadata gate",
    pattern: /infra\/release-metadata\.production\.json|release_version/u,
  },
  { label: "production domain target", pattern: /edge-matte\.ozby\.dev/u },
  { label: "post-deploy /health smoke", pattern: /wait-for-http\.sh.*\/health|\/health/u },
  {
    label: "post-deploy root smoke",
    pattern: /wait-for-http\.sh|edge-matte\.ozby\.dev\/["'\s]|curl[^\n]*\/["'\s]/u,
  },
  {
    label: "verify paths policy",
    pattern: /wp audit absolute-path-policy --root \.|vp run verify:paths/u,
  },
  { label: "architecture drift audit", pattern: /wp audit architecture-drift --root \./u },
  { label: "production-smoke e2e suite", pattern: /production-smoke/u },
  { label: "production-journey e2e suite", pattern: /production-journey/u },
  { label: "repo-owned production secret profile", pattern: /secret_profile:\s*production/u },
  {
    label: "production token secret mapping",
    pattern:
      /ci_secret_provider_token:\s*\$\{\{ secrets\.CI_SECRET_PROVIDER_TOKEN_PRODUCTION \}\}/u,
  },
  {
    label: "pre-deploy credential verify",
    pattern: /verify-cloudflare-deploy-creds/u,
  },
  {
    label: "optional access service-token pairing guard",
    pattern: /CF_ACCESS_CLIENT_ID|CF_ACCESS_CLIENT_SECRET/u,
  },
];

export const WAIT_FOR_HTTP_REQUIREMENTS: WorkflowExpectation[] = [
  {
    label: "partial access env guard",
    pattern:
      /CF_ACCESS_CLIENT_ID.*CF_ACCESS_CLIENT_SECRET|CF_ACCESS_CLIENT_SECRET.*CF_ACCESS_CLIENT_ID/su,
  },
  {
    label: "access headers for smoke probes",
    pattern: /CF-Access-Client-Id|CF-Access-Client-Secret/u,
  },
  {
    label: "2xx-only success contract",
    pattern: /status.*\^2.*0-9.*0-9.*\$/su,
  },
];

export const LOCAL_DEPLOY_REQUIREMENTS: WorkflowExpectation[] = [
  {
    label: "shared secret-surface deploy requirement",
    pattern: /CLOUDFLARE_API_TOKEN.*wp secrets run --sink deploy-wrangler --profile production/su,
  },
  {
    label: "deploy contract verify",
    pattern: /run\("pnpm",\s*\["run",\s*"verify:deploy-contract"\]\)/u,
  },
  {
    label: "post-deploy smoke probes",
    pattern: /run\("bash".*infra\/src\/deploy\/wait-for-http\.sh.*PRODUCTION_URL/su,
  },
  {
    label: "production-smoke suite",
    pattern: /production-smoke/u,
  },
  {
    label: "production-journey suite",
    pattern: /production-journey/u,
  },
];

/**
 * @param {string} repoRoot
 * @param {string} relativePath
 */
export function readWorkflow(repoRoot: string, relativePath: string) {
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
export function collectWorkflowRunSteps(contents: string): string[] {
  return contents
    .split("\n")
    .filter((line: string) => /^\s*-\s+run:/u.test(line))
    .map((line: string) => line.replace(/^\s*-\s+run:\s*/u, "").trim());
}

/**
 * Collect `uses:` references from a GitHub Actions workflow file.
 *
 * @param {string} contents
 */
export function collectWorkflowUses(contents: string): string[] {
  return contents.split("\n").flatMap((line) => {
    const match = line.match(/^\s*(?:-\s+)?uses:\s*([^\s#]+)\s*(?:#.*)?$/u);
    return match ? [match[1]] : [];
  });
}

/**
 * @param {string} actionReference
 */
export function isImmutableActionReference(actionReference: string): boolean {
  if (
    actionReference.startsWith("./") ||
    actionReference.startsWith("../") ||
    actionReference.startsWith("docker://")
  ) {
    return true;
  }
  return FULL_SHA_ACTION_REFERENCE_PATTERN.test(actionReference);
}

/**
 * @param {string} contents
 */
export function findMutableUsesReferences(contents: string): string[] {
  return collectWorkflowUses(contents).filter(
    (actionReference: string) => !isImmutableActionReference(actionReference),
  );
}

/**
 * @param {string} contents
 * @param {WorkflowExpectation[]} expectations
 */
export function findMissingExpectations(
  contents: string,
  expectations: WorkflowExpectation[],
): WorkflowExpectation[] {
  return expectations.filter(({ pattern }: WorkflowExpectation) => !pattern.test(contents));
}

/**
 * @param {string} repoRoot
 */
export function listWorkflowFiles(repoRoot: string): string[] {
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
 * @param {string} repoRoot
 */
export function readCodeowners(repoRoot: string) {
  return readWorkflow(repoRoot, CODEOWNERS_WORKFLOW_GOVERNANCE_PATH);
}

/**
 * @param {string} contents
 */
export function findMissingCodeownersProtections(contents: string): WorkflowExpectation[] {
  const expectations: WorkflowExpectation[] = [
    {
      label: "workflow ownership",
      pattern: /^(?!\s*#)\s*\/?\.github\/workflows\/\*\*\s+@[\w./-]+/mu,
    },
    {
      label: "CODEOWNERS self-protection",
      pattern: /^(?!\s*#)\s*\/?\.github\/CODEOWNERS\s+@[\w./-]+/mu,
    },
  ];
  return expectations.filter(({ pattern }) => !pattern.test(contents));
}

/**
 * @param {WorkflowExpectation[]} missing
 * @param {string} workflowPath
 */
export function formatMissingExpectations(
  missing: WorkflowExpectation[],
  workflowPath: string,
): string {
  if (missing.length === 0) {
    return "";
  }
  const labels = missing.map(({ label }: WorkflowExpectation) => `- ${label}`).join("\n");
  return `${workflowPath} is missing IR-1 release expectations:\n${labels}`;
}

/**
 * @param {string[]} mutableUses
 * @param {string} workflowPath
 */
export function formatMutableUses(mutableUses: string[], workflowPath: string): string {
  if (mutableUses.length === 0) {
    return "";
  }
  const list = mutableUses.map((entry: string) => `- ${entry}`).join("\n");
  return `${workflowPath} contains mutable GitHub Actions references:\n${list}`;
}
