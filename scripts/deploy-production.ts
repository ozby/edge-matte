#!/usr/bin/env bun
/**
 * Operator-local production deploy (ingest-lens pattern).
 *
 * Loads Cloudflare deploy credentials from the repo-selected secret manager
 * (configure once: `wp config secrets set doppler ozby-shell`) via `with-secrets`,
 * then runs `wrangler deploy --env production`.
 *
 * Usage:
 *   bun scripts/deploy-production.ts [--skip-build] [--skip-smoke]
 */
import { spawnSync } from "node:child_process";

const PRODUCTION_URL = "https://edge-matte.ozby.dev";
const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const skipSmoke = args.includes("--skip-smoke");

function run(command: string, commandArgs: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    env,
    shell: false,
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

function requireCommand(name: string) {
  const result = spawnSync("command", ["-v", name], {
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    console.error(`Missing required command: ${name}`);
    console.error("Install global Webpresso CLIs so `with-secrets` is on PATH.");
    console.error("Configure infra credentials: wp config secrets set doppler ozby-shell");
    process.exit(1);
  }
}

requireCommand("with-secrets");

if (!skipBuild) {
  console.log("\n▶ Building workspace…\n");
  run("pnpm", ["run", "build"]);
}

console.log("\n▶ Deploying Worker to production via with-secrets (ozby-shell)…\n");
run("with-secrets", [
  "--",
  "pnpm",
  "--filter",
  "@edge-matte/worker",
  "exec",
  "wrangler",
  "deploy",
  "--env",
  "production",
]);

if (skipSmoke) {
  console.log(`\n✅ Deploy finished (smoke skipped). Verify: ${PRODUCTION_URL}/health\n`);
  process.exit(0);
}

console.log("\n▶ Post-deploy smoke…\n");
run("bash", ["scripts/wait-for-http.sh", `${PRODUCTION_URL}/health`, "24", "5"]);
run("bash", ["scripts/wait-for-http.sh", `${PRODUCTION_URL}/`, "12", "5"]);

console.log("\n▶ production-smoke e2e…\n");
run("pnpm", ["e2e", "--", "--suite", "production-smoke"], {
  ...process.env,
  E2E_RUN_PRODUCTION: "1",
});

console.log(`\n✅ Production deploy healthy at ${PRODUCTION_URL}\n`);
