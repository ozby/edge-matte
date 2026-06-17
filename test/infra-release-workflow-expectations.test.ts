/**
 * IR-1 (Wave 1): codify CI / dry-run / smoke workflow expectations before IR-6
 * implements the full GitHub Actions release path.
 *
 * These tests are intentionally strict. They fail until PR CI and the production
 * deploy workflow match docs/architecture.md and
 * blueprints/completed/2026-05-27-edge-matte-infra-and-release.md.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { findRepoRoot } from "#scripts/lib/find-repo-root.ts";
import {
  PR_CI_WORKFLOW,
  PRODUCTION_DEPLOY_WORKFLOW,
  PREVIEW_DEPLOY_WORKFLOW,
  PR_CI_REQUIRED_RUNS,
  PRODUCTION_DEPLOY_REQUIREMENTS,
  PREVIEW_DEPLOY_REQUIREMENTS,
  CODEOWNERS_WORKFLOW_GOVERNANCE_PATH,
  DEPLOY_PRODUCTION_SCRIPT,
  DEPLOY_PREVIEW_SCRIPT,
  PRODUCTION_DOMAIN,
  LOCAL_DEPLOY_REQUIREMENTS,
  readWorkflow,
  readCodeowners,
  collectWorkflowRunSteps,
  findMissingExpectations,
  findMissingCodeownersProtections,
  findMutableUsesReferences,
  formatMissingExpectations,
  formatMutableUses,
  listWorkflowFiles,
  WAIT_FOR_HTTP_REQUIREMENTS,
  WAIT_FOR_HTTP_SCRIPT,
} from "./helpers/infra-release-workflow-expectations.ts";

const root = findRepoRoot(import.meta.dirname);

test("workflow governance directory exists", () => {
  const workflows = listWorkflowFiles(root);
  assert.ok(
    workflows.length > 0,
    "expected at least one GitHub Actions workflow under .github/workflows",
  );
  assert.ok(workflows.includes(PR_CI_WORKFLOW), `expected PR CI workflow at ${PR_CI_WORKFLOW}`);
});

test("all workflow action uses references are pinned to full commit SHAs", () => {
  const workflows = listWorkflowFiles(root);
  assert.ok(workflows.length > 0, "expected at least one workflow to validate");

  for (const workflowPath of workflows) {
    const workflow = readWorkflow(root, workflowPath);
    assert.equal(workflow.exists, true, `${workflowPath} must exist`);

    const mutableUses = findMutableUsesReferences(workflow.contents);
    assert.equal(mutableUses.length, 0, formatMutableUses(mutableUses, workflowPath));
  }
});

test("workflow governance has CODEOWNERS coverage and self-protection", () => {
  const codeowners = readCodeowners(root);
  assert.equal(codeowners.exists, true, `${CODEOWNERS_WORKFLOW_GOVERNANCE_PATH} must exist`);

  const missing = findMissingCodeownersProtections(codeowners.contents);
  assert.equal(
    missing.length,
    0,
    formatMissingExpectations(missing, CODEOWNERS_WORKFLOW_GOVERNANCE_PATH),
  );
});

test("PR CI workflow triggers on pull_request", () => {
  const workflow = readWorkflow(root, PR_CI_WORKFLOW);
  assert.equal(workflow.exists, true, `${PR_CI_WORKFLOW} must exist`);
  assert.match(
    workflow.contents,
    /^\s*pull_request:/mu,
    `${PR_CI_WORKFLOW} must run on pull_request to prove deployability before merge`,
  );
});

test("PR CI workflow includes quality gates, build, docs checks, and dry-run deploy", () => {
  const workflow = readWorkflow(root, PR_CI_WORKFLOW);
  assert.equal(workflow.exists, true, `${PR_CI_WORKFLOW} must exist`);

  const runSteps = collectWorkflowRunSteps(workflow.contents);
  assert.ok(runSteps.length > 0, `${PR_CI_WORKFLOW} must declare shell steps`);

  const missing = findMissingExpectations(workflow.contents, PR_CI_REQUIRED_RUNS);
  assert.equal(missing.length, 0, formatMissingExpectations(missing, PR_CI_WORKFLOW));
});

test("production deploy workflow exists for release-gated production path", () => {
  const workflow = readWorkflow(root, PRODUCTION_DEPLOY_WORKFLOW);
  assert.equal(
    workflow.exists,
    true,
    `${PRODUCTION_DEPLOY_WORKFLOW} is required for main deploy + post-deploy smoke (IR-6 target)`,
  );
});

test("preview deploy workflow exists for main and PR preview lanes", () => {
  const workflow = readWorkflow(root, PREVIEW_DEPLOY_WORKFLOW);
  assert.equal(
    workflow.exists,
    true,
    `${PREVIEW_DEPLOY_WORKFLOW} is required for preview_main and preview_pr_<n> deploys`,
  );
});

test("preview deploy workflow deploys main and PR previews with PR cleanup", () => {
  const workflow = readWorkflow(root, PREVIEW_DEPLOY_WORKFLOW);
  assert.equal(workflow.exists, true, `${PREVIEW_DEPLOY_WORKFLOW} must exist`);

  const missing = findMissingExpectations(workflow.contents, PREVIEW_DEPLOY_REQUIREMENTS);
  assert.equal(missing.length, 0, formatMissingExpectations(missing, PREVIEW_DEPLOY_WORKFLOW));
  assert.doesNotMatch(
    workflow.contents,
    /wrangler deploy[^\n]*--env production/u,
    `${PREVIEW_DEPLOY_WORKFLOW} must not deploy the production Wrangler env`,
  );
});

test("production deploy workflow serializes deploys and runs smoke verification", () => {
  const workflow = readWorkflow(root, PRODUCTION_DEPLOY_WORKFLOW);
  assert.equal(workflow.exists, true, `${PRODUCTION_DEPLOY_WORKFLOW} must exist`);

  const missing = findMissingExpectations(workflow.contents, PRODUCTION_DEPLOY_REQUIREMENTS);
  assert.equal(missing.length, 0, formatMissingExpectations(missing, PRODUCTION_DEPLOY_WORKFLOW));
  assert.doesNotMatch(
    workflow.contents,
    /branches:\s*\[[^\]]*main/u,
    `${PRODUCTION_DEPLOY_WORKFLOW} must not deploy production on ordinary main pushes`,
  );
});

test("production deploy workflow targets the architecture production domain", () => {
  const workflow = readWorkflow(root, PRODUCTION_DEPLOY_WORKFLOW);
  assert.equal(workflow.exists, true, `${PRODUCTION_DEPLOY_WORKFLOW} must exist`);
  assert.match(
    workflow.contents,
    new RegExp(PRODUCTION_DOMAIN.replace(".", "\\."), "u"),
    `${PRODUCTION_DEPLOY_WORKFLOW} must reference ${PRODUCTION_DOMAIN}`,
  );
});

test("wait-for-http supports optional access auth and rejects non-2xx responses", () => {
  const script = readWorkflow(root, WAIT_FOR_HTTP_SCRIPT);
  assert.equal(script.exists, true, `${WAIT_FOR_HTTP_SCRIPT} must exist`);

  const missing = findMissingExpectations(script.contents, WAIT_FOR_HTTP_REQUIREMENTS);
  assert.equal(missing.length, 0, formatMissingExpectations(missing, WAIT_FOR_HTTP_SCRIPT));
});

test("local deploy script keeps truthful smoke and production suites behind with-secrets", () => {
  const script = readWorkflow(root, DEPLOY_PRODUCTION_SCRIPT);
  assert.equal(script.exists, true, `${DEPLOY_PRODUCTION_SCRIPT} must exist`);

  const missing = findMissingExpectations(script.contents, LOCAL_DEPLOY_REQUIREMENTS);
  assert.equal(missing.length, 0, formatMissingExpectations(missing, DEPLOY_PRODUCTION_SCRIPT));
});

test("preview deploy script renders preview-main and preview-pr workers without production env deploys", () => {
  const script = readWorkflow(root, DEPLOY_PREVIEW_SCRIPT);
  assert.equal(script.exists, true, `${DEPLOY_PREVIEW_SCRIPT} must exist`);

  const missing = findMissingExpectations(script.contents, [
    { label: "preview-main lane", pattern: /preview-main/u },
    { label: "preview-pr lane", pattern: /preview-pr/u },
    {
      label: "skip with-secrets when CI already injected Cloudflare creds",
      pattern: /!process\.env\.CLOUDFLARE_API_TOKEN && hasCommand\("with-secrets"\)/u,
    },
    { label: "temporary wrangler config", pattern: /mkdtemp|tmpdir/u },
    { label: "workers.dev disabled", pattern: /workers_dev\s*=\s*false/u },
    {
      label: "preview-main custom domain host",
      pattern: /preview-main\.\$\{DEPLOY_DOMAIN\}/u,
    },
    {
      label: "preview-pr custom domain host",
      pattern: /preview-pr-\$\{prNumber\}\.\$\{DEPLOY_DOMAIN\}/u,
    },
    { label: "preview custom domain route", pattern: /custom_domain\s*=\s*true/u },
    { label: "destroy support", pattern: /"delete"|--destroy/u },
  ]);
  assert.equal(missing.length, 0, formatMissingExpectations(missing, DEPLOY_PREVIEW_SCRIPT));
  assert.doesNotMatch(
    script.contents,
    /wrangler[",\s]+deploy[\s\S]*--env[\s\S]*production/u,
    `${DEPLOY_PREVIEW_SCRIPT} must not deploy the production Wrangler env`,
  );
});
