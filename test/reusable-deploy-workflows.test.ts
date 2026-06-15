import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("preview workflow delegates to the shared reusable preview shell while preserving lane resolution and destroy behavior", () => {
  const workflow = readRepoFile(".github/workflows/deploy-preview.yml");

  assert.match(
    workflow,
    new RegExp(
      String.raw`uses: webpresso/agent-kit/.github/workflows/cloudflare-preview.yml@[0-9a-f]{40}`,
      "u",
    ),
  );
  assert.match(workflow, /branches:\s*\[main\]/u);
  assert.match(workflow, /types:\s*\[opened, synchronize, reopened, closed\]/u);
  assert.match(workflow, /canonical_lane="preview_main"/u);
  assert.match(workflow, /canonical_lane="preview_pr_\$\{PR_NUMBER\}"/u);
  assert.match(workflow, /mode == 'destroy'/u);
  assert.match(workflow, /deploy-preview:/u);
  assert.match(workflow, /deploy-verify:/u);
  assert.match(
    workflow,
    /deploy:preview -- --lane .* --destroy|scripts\/deploy-preview\.ts.*--destroy/u,
  );
});

test("production workflow delegates to the shared reusable production shell while preserving release gating and post-deploy checks", () => {
  const workflow = readRepoFile(".github/workflows/deploy-production.yml");

  assert.match(
    workflow,
    new RegExp(
      String.raw`uses: webpresso/agent-kit/.github/workflows/cloudflare-production.yml@[0-9a-f]{40}`,
      "u",
    ),
  );
  assert.match(workflow, /tags:\s*\["v\*"\]/u);
  assert.match(workflow, /release_version:/u);
  assert.match(workflow, /vp run verify:deploy-contract|pnpm run verify:deploy-contract/u);
  assert.match(
    workflow,
    /vp run e2e -- --suite upload-delete-contract|pnpm run e2e -- --suite upload-delete-contract/u,
  );
  assert.match(
    workflow,
    /E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-journey|E2E_RUN_PRODUCTION=1 pnpm run e2e -- --suite production-journey/u,
  );
});
