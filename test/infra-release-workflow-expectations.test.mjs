/**
 * IR-1 (Wave 1): codify CI / dry-run / smoke workflow expectations before IR-6
 * implements the full GitHub Actions release path.
 *
 * These tests are intentionally strict. They fail until PR CI and the production
 * deploy workflow match docs/architecture.md and
 * blueprints/completed/2026-05-27-edge-matte-infra-and-release.md.
 */
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  PR_CI_WORKFLOW,
  PRODUCTION_DEPLOY_WORKFLOW,
  PR_CI_REQUIRED_RUNS,
  PRODUCTION_DEPLOY_REQUIREMENTS,
  PRODUCTION_DOMAIN,
  readWorkflow,
  collectWorkflowRunSteps,
  findMissingExpectations,
  formatMissingExpectations,
  listWorkflowFiles,
} from "./helpers/infra-release-workflow-expectations.mjs";

const root = resolve(import.meta.dirname, "..");

test("workflow governance directory exists", () => {
  const workflows = listWorkflowFiles(root);
  assert.ok(
    workflows.length > 0,
    "expected at least one GitHub Actions workflow under .github/workflows",
  );
  assert.ok(workflows.includes(PR_CI_WORKFLOW), `expected PR CI workflow at ${PR_CI_WORKFLOW}`);
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

test("production deploy workflow exists for main-branch release path", () => {
  const workflow = readWorkflow(root, PRODUCTION_DEPLOY_WORKFLOW);
  assert.equal(
    workflow.exists,
    true,
    `${PRODUCTION_DEPLOY_WORKFLOW} is required for main deploy + post-deploy smoke (IR-6 target)`,
  );
});

test("production deploy workflow serializes deploys and runs smoke verification", () => {
  const workflow = readWorkflow(root, PRODUCTION_DEPLOY_WORKFLOW);
  assert.equal(workflow.exists, true, `${PRODUCTION_DEPLOY_WORKFLOW} must exist`);

  const missing = findMissingExpectations(workflow.contents, PRODUCTION_DEPLOY_REQUIREMENTS);
  assert.equal(missing.length, 0, formatMissingExpectations(missing, PRODUCTION_DEPLOY_WORKFLOW));
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
