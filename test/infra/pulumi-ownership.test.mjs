import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { R2_BUCKET_NAME, readText, root } from "./helpers.mjs";

const wrangler = readText("wrangler.toml");

test("Pulumi project exists for durable R2 infrastructure (IR-4)", () => {
  assert.ok(
    existsSync(resolve(root, "infra/Pulumi.yaml")),
    "infra/Pulumi.yaml is missing — Pulumi must own the production R2 bucket",
  );
});

test("Pulumi storage program provisions the bucket referenced by Wrangler", () => {
  const storageCandidates = [
    "infra/src/resources/storage.ts",
    "infra/src/storage.ts",
    "infra/src/resources/r2.ts",
  ];
  const storagePath = storageCandidates.find((candidate) => existsSync(resolve(root, candidate)));
  assert.ok(storagePath, `expected a Pulumi storage module (${storageCandidates.join(" or ")})`);

  const storageSource = readText(storagePath);
  assert.match(
    storageSource,
    new RegExp(R2_BUCKET_NAME, "u"),
    `Pulumi must declare the ${R2_BUCKET_NAME} bucket that Wrangler binds`,
  );
  assert.match(
    storageSource,
    /R2Bucket|cloudflare\.R2Bucket|@pulumi\/cloudflare/u,
    "storage program must create an R2 bucket resource",
  );
});

test("Pulumi owns lifecycle cleanup for stale job artifacts", () => {
  const lifecycleCandidates = [
    "infra/src/resources/lifecycle.ts",
    "infra/src/resources/storage.ts",
    "infra/src/lifecycle.ts",
  ];
  const lifecyclePath = lifecycleCandidates.find((candidate) =>
    existsSync(resolve(root, candidate)),
  );
  assert.ok(lifecyclePath, "expected Pulumi lifecycle rules for failed/intermediate R2 objects");

  const lifecycleSource = readText(lifecyclePath);
  assert.match(
    lifecycleSource,
    /lifecycle|expiration|deleteAfter|rule/i,
    "lifecycle module must configure R2 cleanup rules",
  );
});

test("Wrangler references the Pulumi-owned bucket by name without provisioning it", () => {
  assert.doesNotMatch(
    wrangler,
    /new\s+R2Bucket|pulumi/i,
    "Wrangler config must not provision durable infrastructure — that belongs in Pulumi",
  );
  assert.match(wrangler, new RegExp(`bucket_name\\s*=\\s*"${R2_BUCKET_NAME}"`, "u"));
});
