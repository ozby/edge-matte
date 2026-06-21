#!/usr/bin/env bun
/**
 * Operator-local production deploy.
 *
 * Expects Cloudflare deploy credentials to already be present in the
 * environment (for example via
 * `wp secrets run --sink deploy-wrangler --profile production -- bun infra/src/deploy/deploy-production.ts`),
 * then runs `wrangler deploy --env production`. This intentionally fails before
 * deploying unless infra/release-metadata.production.json carries release
 * metadata for a versioned production release.
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

if (!skipBuild) {
  console.log("\n▶ Building workspace…\n");
  run("pnpm", ["run", "build"]);
}

console.log("\n▶ Verifying shared deploy contract…\n");
run("pnpm", ["run", "verify:deploy-contract"]);

if (!process.env.CLOUDFLARE_API_TOKEN) {
  throw new Error(
    "Production deploy requires CLOUDFLARE_API_TOKEN in the environment. Invoke via `wp secrets run --sink deploy-wrangler --profile production -- bun infra/src/deploy/deploy-production.ts`.",
  );
}

console.log("\n▶ Deploying Worker to production via the shared Webpresso secret surface…\n");
run("pnpm", [
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
run("bash", ["infra/src/deploy/wait-for-http.sh", `${PRODUCTION_URL}/health`, "24", "5"]);
run("bash", ["infra/src/deploy/wait-for-http.sh", `${PRODUCTION_URL}/`, "12", "5"]);

console.log("\n▶ production-smoke e2e…\n");
run("pnpm", ["--dir", "apps/e2e", "run", "e2e:run", "--", "--suite", "production-smoke"], {
  ...process.env,
  E2E_RUN_PRODUCTION: "1",
});

console.log("\n▶ production-journey e2e…\n");
run("pnpm", ["--dir", "apps/e2e", "run", "e2e:run", "--", "--suite", "production-journey"], {
  ...process.env,
  E2E_RUN_PRODUCTION: "1",
});

console.log(
  `\n✅ Production deploy healthy at ${PRODUCTION_URL} (/health, /, production-smoke, production-journey)\n`,
);
