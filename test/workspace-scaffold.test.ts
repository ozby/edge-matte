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
  assert.match(pkg.scripts.build, /^vp run -r build$/u);
  for (const [script, expected] of [
    ["lint", "wp lint"],
    ["check-types", "wp typecheck"],
    ["test", 'node --test "test/**/*.test.ts" && vp exec vitest run --config vitest.config.ts'],
    ["e2e", "wp e2e"],
  ]) {
    assert.equal(pkg.scripts[script], expected, `${script} must use the wp surface`);
  }
});

test("required workspace config files exist", () => {
  for (const file of [
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "wrangler.toml",
    "agent-kit.config.ts",
    "webpresso.config.ts",
    "apps/worker/package.json",
    "apps/client/package.json",
    "apps/e2e/package.json",
  ]) {
    assert.ok(existsSync(resolve(root, file)), `missing ${file}`);
  }
});

test("wrangler.toml declares ASSETS binding and production route", () => {
  const wrangler = readText("wrangler.toml");
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

test("scaffolded hooks use global wp binaries and vp-first recovery guidance", () => {
  const hooks = readText(".codex/hooks.json");
  assert.match(hooks, /wp-sessionstart-routing/u);
  assert.match(hooks, /wp-check-dev-link/u);
  assert.match(hooks, /wp-post-tool/u);
  assert.match(hooks, /wp-guard-switch/u);
  assert.match(hooks, /wp-stop-qa/u);
  assert.match(hooks, /Run vp install or wp setup/u);
  assert.doesNotMatch(hooks, /node_modules\/\.bin\/wp-/u);
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
