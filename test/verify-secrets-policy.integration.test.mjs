import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const scriptPath = resolve("scripts/verify-secrets-policy.ts");

function runCheck(cwd) {
  return spawnSync("bun", [scriptPath], { cwd, encoding: "utf8" });
}

function withTempDir(run) {
  const dir = mkdtempSync(join(tmpdir(), "edge-matte-secret-check-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function withTempGitRepo(run) {
  const dir = mkdtempSync(join(tmpdir(), "edge-matte-git-secret-check-"));
  try {
    spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" });
    spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: dir, encoding: "utf8" });
    spawnSync("git", ["config", "user.name", "Test User"], { cwd: dir, encoding: "utf8" });
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function stageAll(cwd) {
  spawnSync("git", ["add", "-A"], { cwd, encoding: "utf8" });
}

test("passes when working tree has no forbidden secret files", () => {
  withTempDir((cwd) => {
    const result = runCheck(cwd);
    assert.equal(result.status, 0);
    assert.match(
      result.stdout,
      /OK: no secret carriers or secret-like values in working tree or git/u,
    );
  });
});

test("fails when .dev.vars is present on disk", () => {
  withTempDir((cwd) => {
    writeFileSync(join(cwd, ".dev.vars"), "TOKEN=secret\n");
    const result = runCheck(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /forbidden secret carrier on disk: \.dev\.vars/u);
  });
});

test("fails when .env file is present on disk", () => {
  withTempDir((cwd) => {
    writeFileSync(join(cwd, ".env.local"), "API_KEY=secret\n");
    const result = runCheck(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /forbidden secret carrier on disk: \.env\.local/u);
  });
});

test("fails when runtime secrets.json is copied into the repo tree", () => {
  withTempDir((cwd) => {
    mkdirSync(join(cwd, ".webpresso"), { recursive: true });
    writeFileSync(
      join(cwd, ".webpresso", "secrets.json"),
      '{"manager":"doppler","projectId":"ozby-shell"}\n',
    );
    const result = runCheck(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /forbidden secret carrier on disk: \.webpresso\/secrets\.json/u);
  });
});

test("allows .env.example for non-secret onboarding docs", () => {
  withTempDir((cwd) => {
    writeFileSync(join(cwd, ".env.example"), "PUBLIC_VALUE=example\n");
    mkdirSync(join(cwd, "nested"), { recursive: true });
    writeFileSync(join(cwd, "nested", ".env.example"), "ALSO_OK=1\n");
    const result = runCheck(cwd);
    assert.equal(result.status, 0);
  });
});

test("passes when git tracks only safe files", () => {
  withTempGitRepo((cwd) => {
    writeFileSync(join(cwd, "README.md"), "# safe\n");
    stageAll(cwd);
    spawnSync("git", ["commit", "-m", "init"], { cwd, encoding: "utf8" });

    const result = runCheck(cwd);
    assert.equal(result.status, 0);
  });
});

test("fails when git tracks .dev.vars", () => {
  withTempGitRepo((cwd) => {
    writeFileSync(join(cwd, ".dev.vars"), "TOKEN=secret\n");
    stageAll(cwd);
    spawnSync("git", ["commit", "-m", "bad"], { cwd, encoding: "utf8" });

    const result = runCheck(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /tracked forbidden secret carrier: \.dev\.vars/u);
  });
});

test("fails when git tracks secret-like values in source files", () => {
  withTempGitRepo((cwd) => {
    writeFileSync(join(cwd, "README.md"), "token=ghp_1234567890123456789012345678901234567890\n");
    stageAll(cwd);
    spawnSync("git", ["commit", "-m", "bad"], { cwd, encoding: "utf8" });

    const result = runCheck(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /secret-like value pattern: README\.md/u);
  });
});

test("validates committed webpresso secrets config metadata", () => {
  withTempGitRepo((cwd) => {
    mkdirSync(join(cwd, ".webpresso"), { recursive: true });
    writeFileSync(
      join(cwd, ".webpresso", "secrets.config.json"),
      `${JSON.stringify({ manager: "doppler", projectId: "ozby-shell", CLOUDFLARE_API_TOKEN: "ghp_test" }, null, 2)}\n`,
    );
    stageAll(cwd);
    spawnSync("git", ["commit", "-m", "bad config"], { cwd, encoding: "utf8" });

    const result = runCheck(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unexpected key|must not contain secret values/u);
  });
});

test("repo working tree and git index pass secret guard", () => {
  const result = runCheck(resolve("."));
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
