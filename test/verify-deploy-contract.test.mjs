import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { findRepoRoot } from "#scripts/lib/find-repo-root.mjs";

const REPO_ROOT = findRepoRoot(import.meta.dirname);
const SCRIPT = join(REPO_ROOT, "scripts/verify-deploy-contract.ts");

function writeBaseRepo(dir, wranglerToml) {
  mkdirSync(join(dir, "infra"), { recursive: true });
  writeReleaseMetadata(dir, {
    releaseKind: "version_pr",
    durableObjectMigration: "none",
    rolloutMode: "direct",
    requiredChecks: ["production-smoke", "production-journey"],
  });
  writeFileSync(join(dir, "wrangler.toml"), wranglerToml);
}

function writeReleaseMetadata(dir, metadata) {
  writeFileSync(
    join(dir, "infra/release-metadata.production.json"),
    JSON.stringify(metadata, null, 2) + "\n",
  );
}

function runVerifier(cwd) {
  return spawnSync("bun", [SCRIPT], { cwd, encoding: "utf8" });
}

test("verify-deploy-contract fails when env.production name drifts even if top-level name is unchanged", () => {
  const dir = mkdtempSync(join(tmpdir(), "edge-matte-deploy-contract-"));
  writeBaseRepo(
    dir,
    [
      'name = "edge-matte"',
      "",
      "[env.production]",
      'name = "edge-matte-prod"',
      "workers_dev = false",
      "",
      "[[env.production.routes]]",
      'pattern = "edge-matte.ozby.dev"',
      "custom_domain = true",
      "",
    ].join("\n"),
  );

  const result = runVerifier(dir);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr + result.stdout,
    /\[env\.production\].*stable production Worker name "edge-matte"/u,
  );

  rmSync(dir, { recursive: true, force: true });
});

test("verify-deploy-contract passes when env.production keeps the stable worker name", () => {
  const dir = mkdtempSync(join(tmpdir(), "edge-matte-deploy-contract-"));
  writeBaseRepo(
    dir,
    [
      'name = "edge-matte"',
      "",
      "[env.production]",
      'name = "edge-matte"',
      "workers_dev = false",
      "",
      "[[env.production.routes]]",
      'pattern = "edge-matte.ozby.dev"',
      "custom_domain = true",
      "",
    ].join("\n"),
  );

  const result = runVerifier(dir);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /deploy contract verified/u);

  rmSync(dir, { recursive: true, force: true });
});

test("verify-deploy-contract fails closed when a Durable Object migration asks for gradual rollout", () => {
  const dir = mkdtempSync(join(tmpdir(), "edge-matte-deploy-contract-"));
  writeBaseRepo(
    dir,
    [
      'name = "edge-matte"',
      "",
      "[env.production]",
      'name = "edge-matte"',
      "workers_dev = false",
      "",
      "[[env.production.routes]]",
      'pattern = "edge-matte.ozby.dev"',
      "custom_domain = true",
      "",
    ].join("\n"),
  );
  writeReleaseMetadata(dir, {
    releaseKind: "version_pr",
    durableObjectMigration: "required",
    rolloutMode: "gradual",
    requiredChecks: ["production-smoke"],
  });

  const result = runVerifier(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /Durable Object releases must use rolloutMode=direct/u);

  rmSync(dir, { recursive: true, force: true });
});
