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
  assert.equal(plan.steps[0]?.kind, "command");
  assert.equal(plan.steps[0]?.args.at(-2), "--lane");
  assert.equal(plan.steps[0]?.args.at(-1), "preview-main");
});

test("preview_pr_<n> deploy preserves the PR number in the preview script lane", () => {
  const plan = webpressoDeployAdapter.createPlan({ lane: "preview_pr_123", dryRun: false });

  assert.deepEqual(plan.requiredCredentials, ["CLOUDFLARE_API_TOKEN"]);
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]?.kind, "command");
  assert.equal(plan.steps[0]?.args.at(-2), "--lane");
  assert.equal(plan.steps[0]?.args.at(-1), "preview-pr-123");
});

test("preview dry-runs validate the generated preview config without publishing", () => {
  const plan = webpressoDeployAdapter.createPlan({ lane: "preview_pr_42", dryRun: true });

  assert.deepEqual(plan.requiredCredentials, []);
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0]?.kind, "command");
  assert.deepEqual(plan.steps[0]?.args.slice(-3), ["--lane", "preview-pr-42", "--dry-run"]);
});

test("unsupported lanes fail fast", () => {
  assert.throws(
    () => webpressoDeployAdapter.createPlan({ lane: "preview", dryRun: false }),
    /Unsupported deploy lane: preview/u,
  );
});
