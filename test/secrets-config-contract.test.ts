import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { findRepoRoot } from "#scripts/lib/find-repo-root.ts";

const root = findRepoRoot(import.meta.dirname);

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8")) as Record<string, unknown>;
}

function object(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

test("secrets metadata uses the exact schema-v1 Doppler authority contract", () => {
  const config = readJson(".webpresso/secrets.config.json");

  assert.equal(config["schemaVersion"], 1);
  assert.deepEqual(config["providers"], {
    default: {
      type: "doppler",
      workspace: "ozby",
      workspaceId: "7abb07fb8507f57c2011",
      project: "ozby-dev",
    },
  });
  assert.deepEqual(config["profiles"], {
    preview: { provider: "default", environment: "stg" },
    production: { provider: "default", environment: "prd" },
  });
});

test("root consumer setup keeps agent-config local and agent-kit global", () => {
  const pkg = readJson("package.json");
  const declaredDependencies: Record<string, unknown> = {
    ...object(pkg["dependencies"] ?? {}),
    ...object(pkg["devDependencies"] ?? {}),
    ...object(pkg["optionalDependencies"] ?? {}),
    ...object(pkg["peerDependencies"] ?? {}),
  };
  const scripts = object(pkg["scripts"]);

  assert.equal(scripts["setup:agent"], "wp setup");
  assert.equal(declaredDependencies["@webpresso/app-config"], "catalog:");
  assert.ok(
    !("@webpresso/agent-kit" in declaredDependencies),
    "root package must not declare a local @webpresso/agent-kit dependency",
  );
});
