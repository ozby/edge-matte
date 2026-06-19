import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { findRepoRoot } from "#scripts/lib/find-repo-root.ts";

const root = findRepoRoot(import.meta.dirname);

function readJson(relativePath: string): any {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8")) as any;
}

function readText(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("root package.json keeps vp for recursive build and wp for quality lanes", () => {
  const pkg = readJson("package.json");
  assert.equal(
    pkg.scripts.build,
    "vp run --filter @edge-matte/client build && vp run --filter @edge-matte/worker build",
  );
  for (const [script, expected] of [
    ["lint", "wp lint"],
    [
      "check-types",
      "vp run --filter @edge-matte/client check-types && vp run --filter @edge-matte/e2e check-types && vp run --filter @edge-matte/worker check-types && vp run --filter @edge-matte/infra check-types && vp exec tsc -p tsconfig.json --noEmit",
    ],
    [
      "test",
      'vp run --filter @edge-matte/client test && vp run --filter @edge-matte/e2e test && vp run --filter @edge-matte/worker test && vp run --filter @edge-matte/infra test && node --test "test/**/*.test.ts"',
    ],
    ["e2e", "wp e2e"],
  ]) {
    assert.equal(pkg.scripts[script], expected, `${script} must use the wp surface`);
  }
});

test("required workspace config files exist", () => {
  for (const file of [
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "apps/workers/wrangler.toml",
    "agent-kit.config.ts",
    "webpresso.config.ts",
    "apps/workers/package.json",
    "apps/client/package.json",
    "apps/e2e/package.json",
  ]) {
    assert.ok(existsSync(resolve(root, file)), `missing ${file}`);
  }
});

test("apps/workers/wrangler.toml declares ASSETS binding and production route", () => {
  const wrangler = readText("apps/workers/wrangler.toml");
  assert.match(wrangler, /binding\s*=\s*"ASSETS"/u);
  assert.match(wrangler, /edge-matte\.ozby\.dev/u);
  assert.match(wrangler, /custom_domain\s*=\s*true/u);
});

test("agent-kit.config.ts wires the e2e host adapter", () => {
  const config = readText("agent-kit.config.ts");
  assert.match(config, /hostAdapterModule/u);
  assert.match(config, /\.\/apps\/e2e\/src\/agent-kit-host-adapter/u);
  assert.match(config, /deploy:\s*\{/u);
  assert.match(config, /metadataPath:\s*"infra\/release-metadata\.production\.json"/u);
});

test("configured e2e host adapter stays importable on the Node ESM surface", async () => {
  const moduleHref = pathToFileURL(resolve(root, "apps/e2e/src/agent-kit-host-adapter.ts")).href;
  const module = await import(moduleHref);
  assert.equal(typeof module.buildExecutionPlan, "function");
});

test("webpresso.config.ts re-exports the repo config on the canonical upstream surface", () => {
  const config = readText("webpresso.config.ts");
  assert.match(config, /webpressoConfig/u);
  assert.match(config, /agent-kit\.config/u);
});

test("deprecated local setup scaffolds are deleted and owned by Agent Kit cleanup", () => {
  const pkg = readJson("package.json");
  const config = readJson(".webpressorc.json");

  assert.equal(existsSync(resolve(root, ".github/actions/setup-webpresso/action.yml")), false);
  assert.equal(existsSync(resolve(root, "scripts/resolve-webpresso-cli-versions.js")), false);
  assert.equal(pkg.scripts.postinstall, 'test -n "$CI" || wp setup');
  assert.ok(
    config.generatedCleanup?.removePaths?.includes(".github/actions/setup-webpresso/action.yml"),
  );
  assert.ok(
    config.generatedCleanup?.removePaths?.includes("scripts/resolve-webpresso-cli-versions.js"),
  );
});

test("apps/e2e exposes smoke suite manifest wiring", () => {
  const manifest = readText("apps/e2e/src/e2e-suite-manifest.ts");
  assert.match(manifest, /id:\s*['"]smoke['"]/u);
  assert.match(manifest, /journeys\/smoke\.smoke\.test\.ts/u);
  assert.ok(existsSync(resolve(root, "apps/e2e/journeys/smoke.smoke.test.ts")));
  assert.ok(existsSync(resolve(root, "apps/e2e/src/agent-kit-host-adapter.ts")));
});

test("secret onboarding docs exist without forbidden local secret files", () => {
  assert.ok(existsSync(resolve(root, "docs/secrets.md")));
  assert.ok(existsSync(resolve(root, ".env.example")));
  for (const forbidden of [".dev.vars", ".dev.vars.example", ".env", ".env.local"]) {
    assert.equal(existsSync(resolve(root, forbidden)), false, `${forbidden} must not exist`);
  }
});
