import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { findRepoRoot } from "#scripts/lib/find-repo-root.mjs";

const REPO_ROOT = findRepoRoot(import.meta.dirname);

test("absolute path policy audit passes on the repo", () => {
  const output = execFileSync("wp", ["audit", "absolute-path-policy", "--root", "."], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, WP_SKIP_UPDATE_CHECK: "1" },
  });
  assert.match(output, /absolute path policy: OK/u);
});
