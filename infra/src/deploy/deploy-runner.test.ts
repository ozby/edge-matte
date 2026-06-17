import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { buildChildEnv, findRepoRoot } from "./deploy-runner.ts";

function createRepoFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "edge-matte-deploy-runner-"));
  writeFileSync(join(root, "package.json"), '{"name":"fixture","private":true}\n');
  writeFileSync(join(root, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n  - "infra"\n');
  writeFileSync(join(root, "AGENTS.md"), "# fixture\n");
  mkdirSync(join(root, "infra", "src", "deploy"), { recursive: true });
  return root;
}

describe("deploy-runner helpers", () => {
  it("finds the repo root from a nested infra deploy path", () => {
    const root = createRepoFixture();
    try {
      expect(findRepoRoot(join(root, "infra", "src", "deploy"))).toBe(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("prepends the repo-local node_modules bin directory to PATH", () => {
    const env = buildChildEnv("/repo", { PATH: "/usr/bin:/bin" });
    expect(env.PATH?.split(":").at(0)).toBe("/repo/node_modules/.bin");
    expect(env.PATH).toContain("/usr/bin:/bin");
  });
});
