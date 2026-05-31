#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const METADATA_PATH = path.join(ROOT, "infra", "release-metadata.production.json");
const WRANGLER_PATH = path.join(ROOT, "wrangler.toml");

type ReleaseMetadata = {
  releaseKind: "version_pr" | "manual_hotfix";
  durableObjectMigration: "none" | "required";
  rolloutMode: "direct" | "gradual";
  requiredChecks: string[];
};

function fail(message: string): never {
  throw new Error(message);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function findSection(source: string, header: string): string {
  const start = source.indexOf(header);
  if (start === -1) {
    fail(`wrangler.toml must keep ${header}`);
  }
  const nextHeader = source.indexOf("\n[", start + header.length);
  return source.slice(start, nextHeader === -1 ? undefined : nextHeader);
}

function main() {
  const metadata = readJson<ReleaseMetadata>(METADATA_PATH);
  if (!Array.isArray(metadata.requiredChecks) || metadata.requiredChecks.length === 0) {
    fail("release metadata must declare at least one required check");
  }

  if (
    metadata.durableObjectMigration === "required" &&
    metadata.rolloutMode !== "direct"
  ) {
    fail("migration-bearing Durable Object releases must use rolloutMode=direct");
  }

  const wrangler = readFileSync(WRANGLER_PATH, "utf8");
  const productionSection = findSection(wrangler, "[env.production]");
  if (!/name\s*=\s*"edge-matte"/u.test(productionSection)) {
    fail('wrangler.toml [env.production] must preserve the stable production Worker name "edge-matte"');
  }
  if (!/\[\[env\.production\.routes\]\]/u.test(wrangler)) {
    fail("wrangler.toml must keep [[env.production.routes]]");
  }

  console.log(
    "deploy contract verified: metadata present, rollout mode valid, and env.production remains the stable production target",
  );
}

main();
