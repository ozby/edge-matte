import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = "/Users/ozby/repos/ozby/edge-matte";
const scriptPath = path.join(repoRoot, "scripts/check_architecture_drift.py");

test("check_architecture_drift.py falls back to ~/.bun/bin/wp when PATH lacks wp", () => {
  const fakeHome = mkdtempSync(path.join(os.tmpdir(), "edge-matte-wp-home-"));
  const bunBin = path.join(fakeHome, ".bun", "bin");
  mkdirSync(bunBin, { recursive: true });

  const sentinel = path.join(fakeHome, "wp-invocation.txt");
  const fakeWp = path.join(bunBin, "wp");
  writeFileSync(
    fakeWp,
    `#!/usr/bin/env bash
printf '%s\n' "$0 $*" > "${sentinel}"
exit 0
`,
    "utf8",
  );
  chmodSync(fakeWp, 0o755);

  const result = spawnSync("python3", [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: fakeHome,
      PATH: "/usr/bin:/bin",
    },
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const invocation = readFileSync(sentinel, "utf8");
  assert.match(invocation, /\/\.bun\/bin\/wp audit architecture-drift --root \./u);
});
