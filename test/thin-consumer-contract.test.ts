import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { findRepoRoot } from "#scripts/lib/find-repo-root.ts";

const root = findRepoRoot(import.meta.dirname);

function readJson(relativePath: string): any {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8")) as any;
}

const packagePaths = [
  "apps/client/package.json",
  "apps/e2e/package.json",
  "apps/workers/package.json",
  "infra/package.json",
];

const requiredToolchainDependencies = new Map([
  [
    "package.json",
    [
      "@playwright/test",
      "@stryker-mutator/core",
      "@stryker-mutator/vitest-runner",
      "typescript",
      "vitest",
    ],
  ],
  ["apps/client/package.json", ["typescript", "vite", "vitest"]],
  ["apps/e2e/package.json", ["@playwright/test", "typescript", "vitest"]],
  [
    "apps/workers/package.json",
    [
      "@stryker-mutator/core",
      "@stryker-mutator/typescript-checker",
      "@stryker-mutator/vitest-runner",
      "typescript",
      "vitest",
      "wrangler",
    ],
  ],
  ["infra/package.json", ["tsx", "typescript"]],
]);

test("root command surface keeps vp as substrate while routing quality work through wp", () => {
  const pkg = readJson("package.json");
  const config = readJson(".webpressorc.json");

  assert.equal(
    pkg.scripts.build,
    "vp run --filter @edge-matte/client build && vp run --filter @edge-matte/worker build",
  );

  assert.equal(pkg.scripts["setup:agent"], "wp setup");
  assert.equal(pkg.scripts.lint, "wp lint");
  assert.equal(
    pkg.scripts.test,
    'vp run --filter @edge-matte/client test && vp run --filter @edge-matte/e2e test && vp run --filter @edge-matte/worker test && vp run --filter @edge-matte/infra test && node --test "test/**/*.test.ts"',
  );
  assert.equal(pkg.scripts.typecheck, "vp run check-types");
  assert.equal(
    pkg.scripts["check-types"],
    "vp run --filter @edge-matte/client check-types && vp run --filter @edge-matte/e2e check-types && vp run --filter @edge-matte/worker check-types && vp run --filter @edge-matte/infra check-types && vp exec tsc -p tsconfig.json --noEmit",
  );
  assert.equal(pkg.scripts.e2e, "wp e2e");
  assert.equal(pkg.scripts.mutation, "wp test --mutation");
  assert.equal(pkg.scripts["docs:check"], "wp audit docs-frontmatter");
  assert.equal(pkg.scripts["blueprints:check"], "wp audit blueprint-lifecycle");
  assert.equal(pkg.scripts["verify:paths"], "wp audit absolute-path-policy --root .");
  assert.equal(
    pkg.scripts["act:ci:e2e"],
    "wp ci act --workflow-path .github/workflows/ci.yml --job e2e --execute",
  );
  assert.equal(config.guard?.packageManager, "vp-only");
  assert.deepEqual(config.guard?.scriptRoutes, {
    "verify:paths": "absolute-path-policy",
    "docs:check": "docs-frontmatter",
    "blueprints:check": "blueprint-lifecycle",
  });
});

test("root package declares the shared CI toolchain without package-local wrapper deps", () => {
  const pkg = readJson("package.json");
  assert.equal(pkg.devDependencies?.["@webpresso/agent-config"], "catalog:");
  assert.ok(
    !pkg.devDependencies?.["@webpresso/agent-kit"],
    "root package must use global wp/agent-kit, not a local agent-kit devDependency",
  );
  assert.equal(pkg.devDependencies?.["vite-plus"], "^0.2.1");
});

test("package-local quality scripts route through wp surfaces", () => {
  for (const packagePath of packagePaths) {
    const pkg = readJson(packagePath);

    assert.equal(pkg.scripts["check-types"], "wp typecheck");
    if ("lint" in pkg.scripts) {
      assert.equal(pkg.scripts.lint, "wp lint");
    }
    if (packagePath === "apps/workers/package.json") {
      assert.equal(pkg.scripts.test, "vitest run --config vitest.config.ts");
    } else if ("test" in pkg.scripts) {
      assert.match(pkg.scripts.test, /^wp test\b/u);
    }
    if ("test:journeys" in pkg.scripts) {
      assert.equal(pkg.scripts["test:journeys"], "wp e2e");
    }
  }
});

test("toolchain-owning packages declare the binaries and imports they execute", () => {
  for (const [packagePath, requiredDependencies] of requiredToolchainDependencies) {
    const pkg = readJson(packagePath);
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    for (const dependency of requiredDependencies) {
      assert.ok(dependency in deps, `${packagePath} must declare ${dependency}`);
    }
  }
});

test("package-local wp exec scripts stay normalized without duplicate wrappers", () => {
  for (const packagePath of packagePaths) {
    const pkg = readJson(packagePath);
    for (const [name, command] of Object.entries(pkg.scripts as Record<string, string>)) {
      assert.doesNotMatch(
        command,
        /\bwp exec\s+wp exec\b/u,
        `${packagePath}#${name} must not duplicate wp exec`,
      );
    }
  }
});

test("workspace packages stay thin consumers without local wrapper dependencies", () => {
  for (const packagePath of packagePaths) {
    const pkg = readJson(packagePath);
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    assert.ok(
      !("@webpresso/agent-kit" in deps),
      `${packagePath} must not add a package-local @webpresso/agent-kit dependency`,
    );
    assert.ok(
      !("vite-plus" in deps),
      `${packagePath} must not add a package-local vite-plus dependency`,
    );
  }
});

test("repo does not keep a local pretool-guard workaround", () => {
  assert.equal(existsSync(resolve(root, "scripts/mcp-first-pretool-guard.ts")), false);
  assert.equal(
    readJson(".webpressorc.json").guard?.packageManager,
    "vp-only",
    "guard policy must live in .webpressorc.json",
  );
});

test("repo exposes the generated OpenCode plugin surface", () => {
  assert.equal(existsSync(resolve(root, "opencode.json")), true);
});
