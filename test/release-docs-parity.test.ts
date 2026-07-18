import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { findRepoRoot } from "#scripts/lib/find-repo-root.ts";

const root = findRepoRoot(import.meta.dirname);
const releaseDoc = readFileSync(resolve(root, "docs/release.md"), "utf8");

function section(heading: string): string {
  const marker = `## ${heading}\n`;
  const start = releaseDoc.indexOf(marker);
  assert.notEqual(start, -1, `expected docs/release.md to contain ${marker.trim()}`);

  const bodyStart = start + marker.length;
  const nextHeading = releaseDoc.indexOf("\n## ", bodyStart);
  return releaseDoc.slice(bodyStart, nextHeading === -1 ? undefined : nextHeading);
}

test("release docs define healthy production as both production suites passing", () => {
  assert.match(
    releaseDoc,
    /A deployment is \*\*not healthy\*\* until both `production-smoke` and\s+`production-journey` pass against the public URL\./u,
  );
});

test("production release path documents both post-deploy production suites", () => {
  const ciAndRelease = section("CI and release path");
  assert.match(ciAndRelease, /E2E_RUN_PRODUCTION=1 wp run e2e -- --suite production-smoke/u);
  assert.match(ciAndRelease, /E2E_RUN_PRODUCTION=1 wp run e2e -- --suite production-journey/u);
});

test("release checklist and rollback both require production-smoke plus production-journey", () => {
  const checklist = section("Release checklist");
  assert.match(
    checklist,
    /Post-deploy verification runs both `production-smoke` and `production-journey` against the public URL/u,
  );

  const rollback = section("Rollback");
  assert.match(rollback, /both `production-smoke` \+ `production-journey` green after deploy/u);
  assert.match(
    rollback,
    /Re-run post-deploy verification \(`\/health`, `\/`, `production-smoke`, and `production-journey`\)/u,
  );
});
