import assert from "node:assert/strict";
import test from "node:test";
import { webpressoDeployAdapter } from "../scripts/agent-kit-deploy-adapter.ts";

test("production dry-run uses wrangler without credentials", () => {
  const plan = webpressoDeployAdapter.createPlan({ lane: "prd", dryRun: true });

  assert.equal(plan.lane, "prd");
  assert.deepEqual(plan.requiredCredentials, []);
  assert.equal(plan.steps.length, 1);
  assert.deepEqual(plan.steps[0], {
    kind: "managed-tool",
    id: "wrangler-dry-run",
    label: "Validate Cloudflare Worker deploy without publishing",
    tool: "wrangler",
    args: ["deploy", "--dry-run", "--env", "production"],
    cwd: plan.steps[0]?.cwd,
  });
});

test("preview_main deploy maps the internal lane id to the preview script lane", () => {
  const plan = webpressoDeployAdapter.createPlan({ lane: "preview_main", dryRun: false });

  assert.deepEqual(plan.requiredCredentials, ["CLOUDFLARE_API_TOKEN"]);
  assert.equal(plan.steps.length, 1);
  const step = plan.steps[0];
  assert.equal(step?.kind, "command");
  if (!step || step.kind !== "command") throw new Error("expected command step");
  assert.equal(step.runtimeProfile, "secrets-only");
  assert.equal(step.args.at(-2), "--lane");
  assert.equal(step.args.at(-1), "preview-main");
});

test("preview_pr_<n> deploy preserves the PR number in the preview script lane", () => {
  const plan = webpressoDeployAdapter.createPlan({ lane: "preview_pr_123", dryRun: false });

  assert.deepEqual(plan.requiredCredentials, ["CLOUDFLARE_API_TOKEN"]);
  assert.equal(plan.steps.length, 1);
  const step = plan.steps[0];
  assert.equal(step?.kind, "command");
  if (!step || step.kind !== "command") throw new Error("expected command step");
  assert.equal(step.args.at(-2), "--lane");
  assert.equal(step.args.at(-1), "preview-pr-123");
});

test("preview dry-runs validate the generated preview config without publishing", () => {
  const plan = webpressoDeployAdapter.createPlan({ lane: "preview_pr_42", dryRun: true });

  assert.deepEqual(plan.requiredCredentials, []);
  assert.equal(plan.steps.length, 1);
  const step = plan.steps[0];
  assert.equal(step?.kind, "command");
  if (!step || step.kind !== "command") throw new Error("expected command step");
  assert.deepEqual(step.args.slice(-3), ["--lane", "preview-pr-42", "--dry-run"]);
});

test("production deploy delegates exact smoke stages to the shared deploy plan", () => {
  const plan = webpressoDeployAdapter.createPlan({ lane: "prd", dryRun: false, releaseVersion: "1.2.3" });

  assert.deepEqual(plan.requiredCredentials, ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]);
  assert.equal(plan.releaseVersion, "1.2.3");
  assert.equal(plan.steps.length, 5);
  const deployStep = plan.steps[0];
  assert.equal(deployStep?.kind, "command");
  if (!deployStep || deployStep.kind !== "command") throw new Error("expected command step");
  assert.deepEqual(deployStep, {
    kind: "command",
    id: "edge-matte-deploy",
    label: "Run edge-matte prd deploy script",
    command: "bun",
    args: [deployStep.args[0], "--skip-smoke"],
    cwd: deployStep.cwd,
    runtimeProfile: "secrets-only",
  });
  assert.deepEqual(plan.steps[1], {
    kind: "http-check",
    id: "production-health",
    label: "Verify production /health",
    stage: "health",
    url: "https://edge-matte.ozby.dev/health",
    headers: {
      "CF-Access-Client-Id": "${CF_ACCESS_CLIENT_ID}",
      "CF-Access-Client-Secret": "${CF_ACCESS_CLIENT_SECRET}",
    },
    cwd: plan.steps[1]?.cwd,
    runtimeProfile: "secrets-only",
    retries: 24,
    intervalMs: 5_000,
    timeoutMs: 10_000,
  });
  assert.deepEqual(plan.steps[2], {
    kind: "http-check",
    id: "production-homepage",
    label: "Verify production homepage",
    stage: "homepage",
    url: "https://edge-matte.ozby.dev/",
    headers: {
      "CF-Access-Client-Id": "${CF_ACCESS_CLIENT_ID}",
      "CF-Access-Client-Secret": "${CF_ACCESS_CLIENT_SECRET}",
    },
    cwd: plan.steps[2]?.cwd,
    runtimeProfile: "secrets-only",
    retries: 12,
    intervalMs: 5_000,
    timeoutMs: 10_000,
  });
  assert.deepEqual(plan.steps[3], {
    kind: "command",
    id: "production-smoke",
    label: "Run production-smoke suite",
    stage: "production_smoke",
    command: "pnpm",
    args: ["e2e", "--", "--suite", "production-smoke"],
    cwd: plan.steps[3]?.cwd,
    runtimeProfile: "secrets-only",
    env: { E2E_RUN_PRODUCTION: "1" },
  });
  assert.deepEqual(plan.steps[4], {
    kind: "command",
    id: "production-journey",
    label: "Run production-journey suite",
    stage: "production_journey",
    command: "pnpm",
    args: ["e2e", "--", "--suite", "production-journey"],
    cwd: plan.steps[4]?.cwd,
    runtimeProfile: "secrets-only",
    env: { E2E_RUN_PRODUCTION: "1" },
  });
});

test("unsupported lanes fail fast", () => {
  assert.throws(
    () => webpressoDeployAdapter.createPlan({ lane: "preview", dryRun: false }),
    /Unsupported deploy lane: preview/u,
  );
});
