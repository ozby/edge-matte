import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

/** @typedef {{ label: string; pattern: RegExp }} WorkflowExpectation */

export const PRODUCTION_DOMAIN = "edge-matte.ozby.dev";

export const PR_CI_WORKFLOW = ".github/workflows/ci.webpresso.yml";

export const PRODUCTION_DEPLOY_WORKFLOW = ".github/workflows/deploy.production.yml";
export const WAIT_FOR_HTTP_SCRIPT = "scripts/wait-for-http.sh";
export const DEPLOY_PRODUCTION_SCRIPT = "scripts/deploy-production.ts";

export const CODEOWNERS_WORKFLOW_GOVERNANCE_PATH = ".github/CODEOWNERS";

export const FULL_SHA_ACTION_REFERENCE_PATTERN = /^[^@\s]+@[0-9a-f]{40}$/u;

/** PR CI must prove deployability without mutating production (IR-1 / blueprint task 5). */
export const PR_CI_REQUIRED_RUNS = /** @type {WorkflowExpectation[]} */ ([
  { label: "frozen install", pattern: /vp install --frozen-lockfile/u },
  { label: "format check", pattern: /format:check|vp fmt --check/u },
  { label: "lint", pattern: /vp run lint/u },
  { label: "typecheck", pattern: /vp run (?:typecheck|check-types)/u },
  { label: "test", pattern: /vp run test/u },
  { label: "build", pattern: /vp run build/u },
  { label: "docs frontmatter audit", pattern: /wp audit docs-frontmatter/u },
  {
    label: "blueprint lifecycle audit",
    pattern: /wp audit blueprint-lifecycle --legacy-omx/u,
  },
  {
    label: "architecture drift audit",
    pattern: /wp audit architecture-drift --root \./u,
  },
  {
    label: "deploy credential verify (dry-run or full probe)",
    pattern: /verify-cloudflare-deploy-creds|deploy --dry-run|deploy:dry-run/u,
  },
]);

/** Main deploy must serialize production releases and verify smoke (IR-1 / blueprint tasks 6–7). */
export const PRODUCTION_DEPLOY_REQUIREMENTS = /** @type {WorkflowExpectation[]} */ ([
  { label: "main branch trigger", pattern: /branches:\s*\[[^\]]*main/u },
  { label: "deploy concurrency", pattern: /concurrency:/u },
  { label: "frozen install", pattern: /vp install --frozen-lockfile/u },
  {
    label: "wrangler deploy",
    pattern: /vp exec --filter @edge-matte\/worker -- wrangler deploy --env production/u,
  },
  { label: "production domain target", pattern: /edge-matte\.ozby\.dev/u },
  { label: "post-deploy /health smoke", pattern: /wait-for-http\.sh.*\/health|\/health/u },
  {
    label: "post-deploy root smoke",
    pattern: /wait-for-http\.sh|edge-matte\.ozby\.dev\/["'\s]|curl[^\n]*\/["'\s]/u,
  },
  { label: "verify paths policy", pattern: /wp audit absolute-path-policy --root \./u },
  { label: "architecture drift audit", pattern: /wp audit architecture-drift --root \./u },
  { label: "production-smoke e2e suite", pattern: /production-smoke/u },
  { label: "production-journey e2e suite", pattern: /production-journey/u },
  {
    label: "doppler deploy credential injection",
    pattern: /dopplerhq\/secrets-fetch-action|DOPPLER_SERVICE_TOKEN|DOPPLER_TOKEN/u,
  },
  {
    label: "pre-deploy credential verify",
    pattern: /verify-cloudflare-deploy-creds/u,
  },
  {
    label: "optional access service-token pairing guard",
    pattern: /CF_ACCESS_CLIENT_ID|CF_ACCESS_CLIENT_SECRET/u,
  },
]);

export const WAIT_FOR_HTTP_REQUIREMENTS = /** @type {WorkflowExpectation[]} */ ([
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
]);

export const LOCAL_DEPLOY_REQUIREMENTS = /** @type {WorkflowExpectation[]} */ ([
  {
    label: "with-secrets deploy",
    pattern: /runWithSecrets\("pnpm".*@edge-matte\/worker/su,
  },
  {
    label: "with-secrets smoke probes",
    pattern: /runWithSecrets\("bash".*scripts\/wait-for-http\.sh.*PRODUCTION_URL/su,
  },
  {
    label: "production-smoke suite",
    pattern: /production-smoke/u,
  },
  {
    label: "production-journey suite",
    pattern: /production-journey/u,
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
 * Collect `uses:` references from a GitHub Actions workflow file.
 *
 * @param {string} contents
 */
export function collectWorkflowUses(contents) {
  return contents.split("\n").flatMap((line) => {
    const match = line.match(/^\s*(?:-\s+)?uses:\s*([^\s#]+)\s*(?:#.*)?$/u);
    return match ? [match[1]] : [];
  });
}

/**
 * @param {string} actionReference
 */
export function isImmutableActionReference(actionReference) {
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
export function findMutableUsesReferences(contents) {
  return collectWorkflowUses(contents).filter(
    (actionReference) => !isImmutableActionReference(actionReference),
  );
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
 * @param {string} repoRoot
 */
export function readCodeowners(repoRoot) {
  return readWorkflow(repoRoot, CODEOWNERS_WORKFLOW_GOVERNANCE_PATH);
}

/**
 * @param {string} contents
 */
export function findMissingCodeownersProtections(contents) {
  const expectations = [
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
export function formatMissingExpectations(missing, workflowPath) {
  if (missing.length === 0) {
    return "";
  }
  const labels = missing.map(({ label }) => `- ${label}`).join("\n");
  return `${workflowPath} is missing IR-1 release expectations:\n${labels}`;
}

/**
 * @param {string[]} mutableUses
 * @param {string} workflowPath
 */
export function formatMutableUses(mutableUses, workflowPath) {
  if (mutableUses.length === 0) {
    return "";
  }
  const list = mutableUses.map((entry) => `- ${entry}`).join("\n");
  return `${workflowPath} contains mutable GitHub Actions references:\n${list}`;
}
