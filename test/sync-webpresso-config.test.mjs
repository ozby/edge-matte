import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { findRepoRoot } from "#scripts/lib/find-repo-root.mjs";

const REPO_ROOT = findRepoRoot(import.meta.dirname);
const SCRIPT = join(REPO_ROOT, "scripts/sync-webpresso-config.ts");

function runSync(cwd, args = []) {
  return spawnSync("bun", [SCRIPT, ...args], { cwd, encoding: "utf8" });
}

function initRepo(dir) {
  mkdirSync(join(dir, ".webpresso"), { recursive: true });
  const init = spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr || init.stdout);
}

test("sync-webpresso-config seeds missing runtime config", () => {
  const dir = mkdtempSync(join(tmpdir(), "edge-matte-wp-config-"));
  mkdirSync(join(dir, ".webpresso"), { recursive: true });

  writeFileSync(
    join(dir, ".webpresso", "secrets.config.json"),
    `${JSON.stringify({ manager: "doppler", projectId: "ozby-shell" }, null, 2)}\n`,
  );
  initRepo(dir);

  const run = runSync(dir);
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const synced = readFileSync(join(dir, ".git", "webpresso", "secrets.json"), "utf8");
  assert.match(synced, /"projectId": "ozby-shell"/u);

  rmSync(dir, { recursive: true, force: true });
});

test("sync-webpresso-config preserves local runtime overrides in seed mode", () => {
  const dir = mkdtempSync(join(tmpdir(), "edge-matte-wp-config-"));
  mkdirSync(join(dir, ".webpresso"), { recursive: true });

  writeFileSync(
    join(dir, ".webpresso", "secrets.config.json"),
    `${JSON.stringify({ manager: "doppler", projectId: "ozby-shell" }, null, 2)}\n`,
  );
  initRepo(dir);

  const runtimeDir = join(dir, ".git", "webpresso");
  mkdirSync(runtimeDir, { recursive: true });
  writeFileSync(
    join(runtimeDir, "secrets.json"),
    `${JSON.stringify({ manager: "doppler", projectId: "custom-local" }, null, 2)}\n`,
  );

  const run = runSync(dir);
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /preserving existing wp selection/u);

  const preserved = readFileSync(join(runtimeDir, "secrets.json"), "utf8");
  assert.match(preserved, /"projectId": "custom-local"/u);

  rmSync(dir, { recursive: true, force: true });
});

test("sync-webpresso-config --force refreshes runtime config", () => {
  const dir = mkdtempSync(join(tmpdir(), "edge-matte-wp-config-"));
  mkdirSync(join(dir, ".webpresso"), { recursive: true });

  writeFileSync(
    join(dir, ".webpresso", "secrets.config.json"),
    `${JSON.stringify({ manager: "doppler", projectId: "ozby-shell" }, null, 2)}\n`,
  );
  initRepo(dir);

  const runtimePath = join(dir, ".git", "webpresso", "secrets.json");
  mkdirSync(join(dir, ".git", "webpresso"), { recursive: true });
  writeFileSync(
    runtimePath,
    `${JSON.stringify({ manager: "doppler", projectId: "custom-local" }, null, 2)}\n`,
  );

  const run = runSync(dir, ["--force"]);
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const synced = readFileSync(runtimePath, "utf8");
  assert.match(synced, /"projectId": "ozby-shell"/u);

  rmSync(dir, { recursive: true, force: true });
});

test("sync-webpresso-config rejects secret-like keys in committed config", () => {
  const dir = mkdtempSync(join(tmpdir(), "edge-matte-wp-config-"));
  mkdirSync(join(dir, ".webpresso"), { recursive: true });

  writeFileSync(
    join(dir, ".webpresso", "secrets.config.json"),
    `${JSON.stringify({ manager: "doppler", projectId: "ozby-shell", CLOUDFLARE_API_TOKEN: "ghp_test" }, null, 2)}\n`,
  );
  initRepo(dir);

  const run = runSync(dir, ["--check-only"]);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr + run.stdout, /unexpected key|must not contain secret values/u);

  rmSync(dir, { recursive: true, force: true });
});

test("committed repo secrets config passes metadata-only validation", () => {
  const run = runSync(REPO_ROOT, ["--check-only"]);
  assert.equal(run.status, 0, run.stderr || run.stdout);
});
