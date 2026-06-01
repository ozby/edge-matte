import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { findRepoRoot } from "#scripts/lib/find-repo-root.mjs";

const root = findRepoRoot(import.meta.dirname);

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
}

const packagePaths = [
  "apps/client/package.json",
  "apps/e2e/package.json",
  "apps/worker/package.json",
  "infra/package.json",
];

const expectedBlockedTypecheckScripts = new Map([
  [
    "apps/client/package.json",
    {
      command: "tsc --noEmit -p tsconfig.json",
      reason:
        "client keeps direct tsc until package-local wp typecheck is smoke-proven in this repo install surface",
    },
  ],
  [
    "apps/e2e/package.json",
    {
      command: "tsc --noEmit -p tsconfig.json",
      reason:
        "e2e keeps direct tsc until package-local wp typecheck is smoke-proven in this repo install surface",
    },
  ],
  [
    "apps/worker/package.json",
    {
      command: "tsc --noEmit -p tsconfig.json",
      reason:
        "worker keeps direct tsc until package-local wp typecheck is smoke-proven in this repo install surface",
    },
  ],
  [
    "infra/package.json",
    {
      command: "tsc --noEmit",
      reason:
        "infra keeps direct tsc until package-local wp typecheck is smoke-proven in this repo install surface",
    },
  ],
]);

const allowedDirectVitestScripts = new Map([
  [
    "apps/client/package.json",
    new Map([
      [
        "test",
        "client keeps direct vitest because agent-kit does not yet ship a package-local wp test surface",
      ],
    ]),
  ],
  [
    "apps/e2e/package.json",
    new Map([
      ["test", "e2e contract tests need an explicit vitest config entrypoint"],
      ["test:journeys", "journey tests need a second explicit vitest config entrypoint"],
    ]),
  ],
  [
    "apps/worker/package.json",
    new Map([
      [
        "test",
        "worker tests keep direct vitest because the package test also couples a client prebuild step",
      ],
    ]),
  ],
]);

test("root command surface keeps vp as substrate and wp as owned quality lane", () => {
  const pkg = readJson("package.json");

  assert.match(pkg.scripts.build, /^vp run -r build$/u);
  assert.match(pkg.scripts.lint, /^vp run -r lint$/u);
  assert.match(pkg.scripts["check-types"], /^vp run -r check-types$/u);

  assert.equal(pkg.scripts["setup:agent"], "wp setup");
  assert.equal(pkg.scripts.typecheck, "wp typecheck");
  assert.equal(pkg.scripts["docs:check"], "wp audit docs-frontmatter");
  assert.equal(pkg.scripts["blueprints:check"], "wp audit blueprint-lifecycle --legacy-omx");
  assert.equal(pkg.scripts["verify:paths"], "wp audit absolute-path-policy --root .");
  assert.equal(
    pkg.scripts["act:ci:e2e"],
    "with-secrets -- act -W .github/workflows/ci.webpresso.yml -j e2e",
  );
});

test("package-local typecheck scripts are either wp-backed or explicitly blocked exceptions", () => {
  for (const packagePath of packagePaths) {
    const pkg = readJson(packagePath);

    const checkTypesCommand = pkg.scripts["check-types"];
    const blockedExpectation = expectedBlockedTypecheckScripts.get(packagePath);

    if (checkTypesCommand === "wp typecheck") {
      continue;
    }

    assert.ok(blockedExpectation, `${packagePath} needs a documented check-types exception`);
    assert.equal(
      checkTypesCommand,
      blockedExpectation.command,
      `${packagePath} check-types must stay on the exact blocked direct-tsc contract until wp typecheck is smoke-proven`,
    );
    assert.match(
      checkTypesCommand,
      /\btsc --noEmit\b/u,
      `${packagePath} check-types must stay on direct tsc only as an explicit exception`,
    );
  }
});

test("direct vitest scripts are limited to explicit documented exceptions", () => {
  const remaining = [];

  for (const packagePath of packagePaths) {
    const pkg = readJson(packagePath);
    const allowedScripts = allowedDirectVitestScripts.get(packagePath) ?? new Map();

    for (const [name, command] of Object.entries(pkg.scripts)) {
      if (!/\bvitest run\b/u.test(command)) {
        continue;
      }

      const reason = allowedScripts.get(name);
      assert.ok(reason, `${packagePath}#${name} needs an explicit thin-consumer justification`);
      remaining.push(`${packagePath}#${name}`);
    }
  }

  assert.deepEqual(remaining.sort(), [
    "apps/client/package.json#test",
    "apps/e2e/package.json#test",
    "apps/e2e/package.json#test:journeys",
    "apps/worker/package.json#test",
  ]);
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
