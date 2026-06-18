#!/usr/bin/env bun
/**
 * Operator-local production deploy (ingest-lens pattern).
 *
 * Loads Cloudflare deploy credentials from the repo-selected secret manager
 * via `with-secrets`,
 * then runs `wrangler deploy --env production`. This intentionally fails before
 * deploying unless infra/release-metadata.production.json carries release
 * metadata for a versioned production release.
 *
 * Usage:
 *   bun infra/src/deploy/deploy-production.ts [--skip-build] [--skip-smoke]
 */
import { spawnSync } from "node:child_process";

const PRODUCTION_URL = "https://edge-matte.ozby.dev";
import { buildChildEnv, findRepoRoot } from "./deploy-runner.ts";

const repoRoot = findRepoRoot(process.cwd());
const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const skipSmoke = args.includes("--skip-smoke");

function run(command: string, commandArgs: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    env: buildChildEnv(repoRoot, env),
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
    env: buildChildEnv(repoRoot, process.env),
    shell: true,
  });
  if (result.status !== 0) {
    console.error(`Missing required command: ${name}`);
    console.error(
      "Run `vp install` (or your repo install command) so the repo-local `with-secrets` binary is available.",
    );
    console.error("Configure infra credentials through the canonical `wp config secrets` surface.");
    process.exit(1);
  }
}

requireCommand("with-secrets");

function runWithSecrets(
  command: string,
  commandArgs: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  run("with-secrets", ["--", command, ...commandArgs], env);
}

if (!skipBuild) {
  console.log("\n▶ Building workspace…\n");
  run("pnpm", ["run", "build"]);
}

console.log("\n▶ Verifying shared deploy contract…\n");
run("pnpm", ["run", "verify:deploy-contract"]);

console.log("\n▶ Deploying Worker to production via the configured secret-provider wrapper…\n");
runWithSecrets("pnpm", [
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
runWithSecrets("bash", [
  "infra/src/deploy/wait-for-http.sh",
  `${PRODUCTION_URL}/health`,
  "24",
  "5",
]);
runWithSecrets("bash", ["infra/src/deploy/wait-for-http.sh", `${PRODUCTION_URL}/`, "12", "5"]);

console.log("\n▶ production-smoke e2e…\n");
runWithSecrets(
  "pnpm",
  ["--dir", "apps/e2e", "run", "e2e:run", "--", "--suite", "production-smoke"],
  {
    ...process.env,
    E2E_RUN_PRODUCTION: "1",
  },
);

console.log("\n▶ production-journey e2e…\n");
runWithSecrets(
  "pnpm",
  ["--dir", "apps/e2e", "run", "e2e:run", "--", "--suite", "production-journey"],
  {
    ...process.env,
    E2E_RUN_PRODUCTION: "1",
  },
);

console.log(
  `\n✅ Production deploy healthy at ${PRODUCTION_URL} (/health, /, production-smoke, production-journey)\n`,
);
