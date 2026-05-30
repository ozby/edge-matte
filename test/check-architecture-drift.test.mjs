import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

test("repo removes the local architecture-drift wrapper script", () => {
  assert.equal(existsSync(resolve(repoRoot, "scripts/check_architecture_drift.py")), false);
});

test("repo surfaces call wp audit architecture-drift directly", () => {
  const files = [
    "AGENTS.md",
    "README.md",
    "docs/release.md",
    ".github/workflows/architecture-contract.yml",
  ];

  for (const file of files) {
    const content = read(file);
    assert.match(
      content,
      /wp audit architecture-drift --root \./u,
      `${file} must use the shared agent-kit architecture-drift audit`,
    );
    assert.doesNotMatch(
      content,
      /check_architecture_drift\.py/u,
      `${file} must not reference the deleted local wrapper`,
    );
  }
});
