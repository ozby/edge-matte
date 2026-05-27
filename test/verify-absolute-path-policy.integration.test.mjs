import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { findRepoRoot } from "#scripts/lib/find-repo-root.mjs";

const REPO_ROOT = findRepoRoot(import.meta.dirname);
const SCRIPT = join(REPO_ROOT, "scripts/verify-absolute-path-policy.ts");

test("absolute path policy audit passes on the repo", () => {
  const run = spawnSync("bun", [SCRIPT], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /OK: absolute path policy/u);
});
