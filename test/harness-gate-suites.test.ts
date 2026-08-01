import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("harness gate suite manifest declares deterministic held-in and held-out suites", () => {
  assert.equal(
    readFileSync("harness-gate/suites.yaml", "utf8"),
    `version: 1
consumer: edge-matte
suites:
  - id: edge-matte.global-wp-smoke
    tier: held-in
    command: wp audit harness-surfaces
    surfaces:
      - generated-agent-surfaces
      - codex-hooks
      - claude-hooks
    proof: validates that global wp harness surfaces remain consumable in edge-matte
  - id: edge-matte.e2e-smoke
    tier: held-in
    command: wp e2e --suite smoke
    surfaces:
      - harness-regression-gate
    proof: validates baseline Playwright smoke wiring through the wp e2e adapter
  - id: edge-matte.worker-contract
    tier: held-out
    command: vp run test -- test/webpresso-deploy-adapter.test.ts
    surfaces:
      - harness-regression-gate
      - generated-agent-surfaces
    proof: validates agent-kit deploy adapter expectations as a stronger held-out consumer check
`,
  );
});
