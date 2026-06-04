#!/usr/bin/env bun
/**
 * Deploy or destroy preview Workers without touching env.production.
 *
 * Usage:
 *   bun scripts/deploy-preview.ts --lane preview-main
 *   bun scripts/deploy-preview.ts --lane preview-pr-123
 *   bun scripts/deploy-preview.ts --lane preview-pr-123 --destroy
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { findRepoRoot } from "./lib/find-repo-root.ts";

const TOP_LEVEL_WORKER_NAME = "edge-matte";
const DEPLOY_DOMAIN = "edge-matte.ozby.dev";
const ACCOUNT_ID = "e93986039ea9bd9729fa534a29e9e88f";
const R2_BUCKET_NAME = "edge-matte-images";
const COMPATIBILITY_DATE = "2025-12-10";
const COMPATIBILITY_FLAGS = ["nodejs_compat"];
const VALID_LANE = /^preview-(?:main|pr-\d+)$/u;

const args = process.argv.slice(2);
const destroy = args.includes("--destroy");
const dryRun = args.includes("--dry-run");
const printConfig = args.includes("--print-config");
const laneArg = args[args.indexOf("--lane") + 1];
const lane = laneArg || deriveLaneFromGitHubEnv();

if (!VALID_LANE.test(lane)) {
  throw new Error(`Preview lane must be preview-main or preview-pr-<n>; got "${lane}"`);
}

const repoRoot = findRepoRoot();
const workerName = `${TOP_LEVEL_WORKER_NAME}-${lane}`;

function deriveLaneFromGitHubEnv(): string {
  if (process.env.GITHUB_EVENT_NAME === "pull_request") {
    const prNumber = process.env.GITHUB_REF_NAME?.match(/^(\d+)\/merge$/u)?.[1];
    if (prNumber) return `preview-pr-${prNumber}`;
  }
  if (process.env.GITHUB_REF_NAME === "main") {
    return "preview-main";
  }
  return "";
}

function run(command: string, commandArgs: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    env,
    shell: false,
    cwd: repoRoot,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `"${[command, ...commandArgs].join(" ")}" exited with status ${result.status ?? 1}`,
    );
  }
}

function hasCommand(command: string): boolean {
  const result = spawnSync("command", ["-v", command], {
    shell: true,
    stdio: "ignore",
  });
  return result.status === 0;
}

function runWithSecrets(command: string, commandArgs: string[]) {
  if (hasCommand("with-secrets")) {
    run("with-secrets", ["--", command, ...commandArgs]);
    return;
  }
  run(command, commandArgs);
}

function previewHost(): string {
  if (lane === "preview-main") {
    return `preview-main.${DEPLOY_DOMAIN}`;
  }
  const prNumber = lane.match(/^preview-pr-(\d+)$/u)?.[1];
  if (!prNumber) {
    throw new Error(`Preview lane must be preview-main or preview-pr-<n>; got "${lane}"`);
  }
  return `preview-pr-${prNumber}.${DEPLOY_DOMAIN}`;
}

function previewOrigin(): string {
  return `https://${previewHost()}`;
}

function renderPreviewWranglerConfig(): string {
  const flags = COMPATIBILITY_FLAGS.map((flag) => `"${flag}"`).join(", ");
  return [
    `name = "${workerName}"`,
    `account_id = "${ACCOUNT_ID}"`,
    `main = "${join(repoRoot, "apps", "worker", "src", "index.ts")}"`,
    `compatibility_date = "${COMPATIBILITY_DATE}"`,
    `compatibility_flags = [${flags}]`,
    "workers_dev = false",
    `routes = [{ pattern = "${previewHost()}", custom_domain = true }]`,
    "",
    "[assets]",
    `directory = "${join(repoRoot, "apps", "client", "dist")}"`,
    'binding = "ASSETS"',
    'not_found_handling = "single-page-application"',
    "run_worker_first = true",
    "",
    "[images]",
    'binding = "IMAGES"',
    "",
    "[[r2_buckets]]",
    'binding = "IMAGES_BUCKET"',
    `bucket_name = "${R2_BUCKET_NAME}"`,
    "",
    "[vars]",
    `APP_ORIGIN = "${previewOrigin()}"`,
    "",
  ].join("\n");
}

function writePreviewConfig(): string {
  const dir = mkdtempSync(join(tmpdir(), "edge-matte-preview-"));
  const configPath = join(dir, "wrangler.preview.toml");
  writeFileSync(configPath, renderPreviewWranglerConfig(), { mode: 0o600 });
  return configPath;
}

if (destroy) {
  if (dryRun) {
    throw new Error("--destroy and --dry-run cannot be combined");
  }
  console.log(`\n▶ Destroying preview Worker ${workerName}\n`);
  runWithSecrets("vp", [
    "exec",
    "--filter",
    "@edge-matte/worker",
    "--",
    "wrangler",
    "delete",
    "--name",
    workerName,
  ]);
  process.exit(0);
}

console.log(`\n▶ Deploying preview Worker ${workerName}\n`);
run("vp", ["run", "--filter", "@edge-matte/client", "build"]);

const configPath = writePreviewConfig();
if (printConfig) {
  console.log(`Preview Wrangler config: ${configPath}`);
}

const deployArgs = ["exec", "--filter", "@edge-matte/worker", "--", "wrangler", "deploy"];
if (dryRun) {
  console.log(`\n▶ Validating preview Worker ${workerName} without publishing\n`);
  run("vp", [...deployArgs, "--dry-run", "--config", configPath]);
  console.log(`\n✅ Preview dry-run validated: ${previewOrigin()}\n`);
  process.exit(0);
}

runWithSecrets("vp", [...deployArgs, "--config", configPath]);

console.log(`\n✅ Preview deployed: ${previewOrigin()}\n`);
