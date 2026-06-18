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
      String.raw`uses: webpresso/github-actions/.github/workflows/cloudflare-preview.yml@[0-9a-f]{40}`,
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
    /deploy:preview -- --lane .* --destroy|infra\/src\/deploy\/deploy-preview\.ts.*--destroy/u,
  );
});

test("package scripts and changeset config expose the shared release surface", () => {
  const pkg = JSON.parse(readRepoFile("package.json")) as {
    version: string;
    scripts: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  assert.equal(pkg.version, "0.1.1");
  assert.equal(pkg.scripts["changeset"], "changeset");
  assert.equal(pkg.scripts["changeset:status"], "changeset status");
  assert.equal(
    pkg.scripts["version"],
    "changeset version && bun scripts/sync-release-metadata-version.ts",
  );
  assert.equal(pkg.scripts["release:publish"], "bun scripts/release-publish.ts");
  assert.ok(pkg.devDependencies?.["@changesets/cli"]);
  assert.match(readRepoFile(".changeset/config.json"), /"privatePackages"/u);
  assert.match(readRepoFile("CHANGELOG.md"), /# Changelog/u);
});

test("production workflow stays manual-only while release.yml delegates Changesets and deploy finalization through the shared reusable shells", () => {
  const workflow = readRepoFile(".github/workflows/deploy-production.yml");
  const releaseWorkflow = readRepoFile(".github/workflows/release.yml");

  assert.match(
    workflow,
    new RegExp(
      String.raw`uses: webpresso/github-actions/.github/workflows/cloudflare-production.yml@[0-9a-f]{40}`,
      "u",
    ),
  );
  assert.doesNotMatch(workflow, /tags:\s*\["v\*"\]/u);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /release_version:/u);

  assert.match(
    releaseWorkflow,
    new RegExp(
      String.raw`uses: webpresso/github-actions/.github/workflows/changesets-release.yml@[0-9a-f]{40}`,
      "u",
    ),
  );
  assert.match(releaseWorkflow, /version_command: vp run version/u);
  assert.match(releaseWorkflow, /publish_command: vp run release:publish/u);
  assert.match(
    releaseWorkflow,
    new RegExp(
      String.raw`uses: webpresso/github-actions/.github/workflows/cloudflare-production.yml@[0-9a-f]{40}`,
      "u",
    ),
  );
  // GitHub Actions cannot pass reusable-workflow outputs directly into a second
  // reusable-workflow call's `with:` / `if:`. The `gate` job bridges the two.
  assert.match(releaseWorkflow, /\bgate:/u);
  assert.match(
    releaseWorkflow,
    /should_deploy: \$\{\{ needs\.release\.outputs\.should_deploy \}\}/u,
  );
  assert.match(
    releaseWorkflow,
    /release_version: \$\{\{ needs\.gate\.outputs\.release_version \}\}/u,
  );
  assert.match(
    releaseWorkflow,
    /permissions:/u,
    "release.yml must declare top-level permissions so the changesets reusable workflow receives contents:write and pull-requests:write (repo default is read-only)",
  );
  assert.match(releaseWorkflow, /contents:\s*write/u);
  assert.match(releaseWorkflow, /pull-requests:\s*write/u);
  assert.match(
    releaseWorkflow,
    /packages:\s*read/u,
    "release.yml must grant packages:read so cloudflare-production.yml job (which sets packages:read) does not exceed the caller's explicit permissions block",
  );
});

test("CI workflow exposes wp-check as the branch-protection-facing quality gate", () => {
  const workflow = readRepoFile(".github/workflows/ci.yml");

  assert.match(workflow, /\n  wp-check:\n/u);
  assert.match(workflow, /name:\s*wp-check/u);
  assert.doesNotMatch(workflow, /\n  check:\n/u);
});

test("CI mutation lane uses the supported repo-owned mutation script", () => {
  const workflow = readRepoFile(".github/workflows/ci.yml");

  assert.match(workflow, /wp test --mutation/u);
  assert.doesNotMatch(workflow, /wp test --affected/u);
});
