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
import { findRepoRoot } from "./lib/find-repo-root";

const TOP_LEVEL_WORKER_NAME = "edge-matte";
const ACCOUNT_ID = "e93986039ea9bd9729fa534a29e9e88f";
const R2_BUCKET_NAME = "edge-matte-images";
const COMPATIBILITY_DATE = "2025-12-10";
const COMPATIBILITY_FLAGS = ["nodejs_compat"];
const VALID_LANE = /^preview-(?:main|pr-\d+)$/u;

const args = process.argv.slice(2);
const destroy = args.includes("--destroy");
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

function workersDevOrigin(): string {
  const subdomain = process.env.CF_WORKERS_DEV_SUBDOMAIN?.trim();
  if (!subdomain) {
    return "https://preview.edge-matte.local";
  }
  return `https://${workerName}.${subdomain}.workers.dev`;
}

function renderPreviewWranglerConfig(): string {
  const flags = COMPATIBILITY_FLAGS.map((flag) => `"${flag}"`).join(", ");
  return [
    `name = "${workerName}"`,
    `account_id = "${ACCOUNT_ID}"`,
    `main = "${join(repoRoot, "apps", "worker", "src", "index.ts")}"`,
    `compatibility_date = "${COMPATIBILITY_DATE}"`,
    `compatibility_flags = [${flags}]`,
    "workers_dev = true",
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
    `APP_ORIGIN = "${workersDevOrigin()}"`,
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
  console.log(`\n▶ Destroying preview Worker ${workerName}\n`);
  run("with-secrets", [
    "--",
    "vp",
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
run("with-secrets", [
  "--",
  "vp",
  "exec",
  "--filter",
  "@edge-matte/worker",
  "--",
  "wrangler",
  "deploy",
  "--config",
  configPath,
]);

console.log(`\n✅ Preview deployed: ${workersDevOrigin()}\n`);
