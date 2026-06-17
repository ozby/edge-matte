import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { findRepoRoot } from "#scripts/lib/find-repo-root.ts";

const REPO_ROOT = findRepoRoot(import.meta.dirname);
const SCRIPT = join(REPO_ROOT, "infra/src/deploy/verify-deploy-contract.ts");

interface ReleaseMetadata {
  releaseKind: string;
  releaseVersion?: string;
  durableObjectMigration: string;
  rolloutMode: string;
  requiredChecks: string[];
}

function writeBaseRepo(dir: string, wranglerToml: string) {
  mkdirSync(join(dir, "infra"), { recursive: true });
  mkdirSync(join(dir, "apps", "workers"), { recursive: true });
  writeFileSync(join(dir, "package.json"), '{"name":"fixture","private":true}\n');
  writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "apps/*"\n  - "infra"\n');
  writeFileSync(join(dir, "AGENTS.md"), "# fixture\n");
  writeReleaseMetadata(dir, {
    releaseKind: "version_pr",
    releaseVersion: "0.1.0",
    durableObjectMigration: "none",
    rolloutMode: "direct",
    requiredChecks: ["production-smoke", "production-journey"],
  });
  writeFileSync(join(dir, "apps", "workers", "wrangler.toml"), wranglerToml);
}

function writeReleaseMetadata(dir: string, metadata: ReleaseMetadata) {
  writeFileSync(
    join(dir, "infra/release-metadata.production.json"),
    JSON.stringify(metadata, null, 2) + "\n",
  );
}

function runVerifier(cwd: string) {
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

test("verify-deploy-contract also passes when invoked from the infra directory", () => {
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

  const result = runVerifier(join(dir, "infra"));
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /deploy contract verified/u);

  rmSync(dir, { recursive: true, force: true });
});

test("verify-deploy-contract requires version_pr metadata to carry a semver releaseVersion", () => {
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
    durableObjectMigration: "none",
    rolloutMode: "direct",
    requiredChecks: ["production-smoke", "production-journey"],
  });

  const result = runVerifier(dir);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /releaseVersion/u);

  rmSync(dir, { recursive: true, force: true });
});

test("verify-deploy-contract accepts version_pr metadata with a semver releaseVersion", () => {
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
    releaseVersion: "0.2.0",
    durableObjectMigration: "none",
    rolloutMode: "direct",
    requiredChecks: ["production-smoke", "production-journey"],
  });

  const result = runVerifier(dir);
  assert.equal(result.status, 0, result.stderr || result.stdout);

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
    releaseVersion: "0.2.0",
    durableObjectMigration: "required",
    rolloutMode: "gradual",
    requiredChecks: ["production-smoke"],
  });

  const result = runVerifier(dir);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr + result.stdout,
    /Durable Object releases must use rolloutMode=direct/u,
  );

  rmSync(dir, { recursive: true, force: true });
});
