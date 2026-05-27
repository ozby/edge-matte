import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { findRepoRoot } from "#scripts/lib/find-repo-root.mjs";

test("absolute path policy audit passes on the repo", () => {
  assert.doesNotThrow(() => {
    execFileSync("wp", ["audit", "absolute-path-policy", "--root", "."], {
      cwd: findRepoRoot(),
      encoding: "utf8",
      env: { ...process.env, WP_SKIP_UPDATE_CHECK: "1" },
    });
  });
});
