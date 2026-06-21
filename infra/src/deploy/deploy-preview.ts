#!/usr/bin/env bun
/**
 * Deploy or destroy preview Workers without touching env.production.
 *
 * Usage:
 *   bun infra/src/deploy/deploy-preview.ts --lane preview-main
 *   bun infra/src/deploy/deploy-preview.ts --lane preview-pr-123
 *   bun infra/src/deploy/deploy-preview.ts --lane preview-pr-123 --destroy
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { buildChildEnv, findRepoRoot } from "./deploy-runner.ts";

const TOP_LEVEL_WORKER_NAME = "edge-matte";
const DEPLOY_DOMAIN = "edge-matte.ozby.dev";
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
const canonicalWranglerConfig = readFileSync(
  join(repoRoot, "apps", "workers", "wrangler.toml"),
  "utf8",
);

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
    env: buildChildEnv(repoRoot, env),
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

function runSecretScoped(command: string, commandArgs: string[]) {
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

function matchTomlValue(pattern: RegExp, label: string): string {
  const match = canonicalWranglerConfig.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Missing ${label} in apps/workers/wrangler.toml`);
  }
  return match[1];
}

function canonicalAccountId(): string {
  return matchTomlValue(/^account_id\s*=\s*"([^"]+)"/mu, "account_id");
}

function canonicalCompatibilityDate(): string {
  return matchTomlValue(/^compatibility_date\s*=\s*"([^"]+)"/mu, "compatibility_date");
}

function canonicalCompatibilityFlags(): string[] {
  const raw = matchTomlValue(/^compatibility_flags\s*=\s*\[([^\]]+)\]/mu, "compatibility_flags");
  return raw
    .split(",")
    .map((part) => part.trim().replace(/^"|"$/gu, ""))
    .filter(Boolean);
}

function canonicalAssetsDirectory(): string {
  return matchTomlValue(/^\[assets\][\s\S]*?^directory\s*=\s*"([^"]+)"/mu, "assets.directory");
}

function canonicalAssetsBinding(): string {
  return matchTomlValue(/^\[assets\][\s\S]*?^binding\s*=\s*"([^"]+)"/mu, "assets.binding");
}

function canonicalNotFoundHandling(): string {
  return matchTomlValue(
    /^\[assets\][\s\S]*?^not_found_handling\s*=\s*"([^"]+)"/mu,
    "assets.not_found_handling",
  );
}

function canonicalRunWorkerFirst(): boolean {
  return /run_worker_first\s*=\s*true/u.test(canonicalWranglerConfig);
}

function canonicalImagesBinding(): string {
  return matchTomlValue(/^\[images\][\s\S]*?^binding\s*=\s*"([^"]+)"/mu, "images.binding");
}

function canonicalR2Binding(): string {
  return matchTomlValue(
    /^\[\[r2_buckets\]\][\s\S]*?^binding\s*=\s*"([^"]+)"/mu,
    "r2_buckets.binding",
  );
}

function canonicalR2BucketName(): string {
  return matchTomlValue(
    /^\[\[r2_buckets\]\][\s\S]*?^bucket_name\s*=\s*"([^"]+)"/mu,
    "r2_buckets.bucket_name",
  );
}

function renderPreviewWranglerConfig(): string {
  const flags = canonicalCompatibilityFlags()
    .map((flag) => `"${flag}"`)
    .join(", ");
  return [
    `name = "${workerName}"`,
    `account_id = "${canonicalAccountId()}"`,
    `main = "${join(repoRoot, "apps", "workers", "src", "index.ts")}"`,
    `compatibility_date = "${canonicalCompatibilityDate()}"`,
    `compatibility_flags = [${flags}]`,
    "workers_dev = false",
    `routes = [{ pattern = "${previewHost()}", custom_domain = true }]`,
    "",
    "[assets]",
    `directory = "${join(repoRoot, "apps", "workers", canonicalAssetsDirectory())}"`,
    `binding = "${canonicalAssetsBinding()}"`,
    `not_found_handling = "${canonicalNotFoundHandling()}"`,
    `run_worker_first = ${canonicalRunWorkerFirst() ? "true" : "false"}`,
    "",
    "[images]",
    `binding = "${canonicalImagesBinding()}"`,
    "",
    "[[r2_buckets]]",
    `binding = "${canonicalR2Binding()}"`,
    `bucket_name = "${canonicalR2BucketName()}"`,
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
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    throw new Error(
      "Preview deploy requires CLOUDFLARE_API_TOKEN in the environment. Invoke via `wp secrets run --sink deploy-wrangler --profile preview -- bun infra/src/deploy/deploy-preview.ts --lane <preview-main|preview-pr-<n>>`.",
    );
  }
  runSecretScoped("vp", [
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

if (!process.env.CLOUDFLARE_API_TOKEN) {
  throw new Error(
    "Preview deploy requires CLOUDFLARE_API_TOKEN in the environment. Invoke via `wp secrets run --sink deploy-wrangler --profile preview -- bun infra/src/deploy/deploy-preview.ts --lane <preview-main|preview-pr-<n>>`.",
  );
}
runSecretScoped("vp", [...deployArgs, "--config", configPath]);

console.log(`\n✅ Preview deployed: ${previewOrigin()}\n`);
