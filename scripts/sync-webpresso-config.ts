#!/usr/bin/env bun
/**
 * Apply committed `.webpresso/secrets.config.json` via `wp config secrets set`.
 * Secret values stay in Doppler/Cloudflare; this file holds manager/project metadata only.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseSecretsConfigMetadata, type SecretsConfigMetadata } from "./lib/secrets-policy.ts";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, ".webpresso", "secrets.config.json");

type Mode = "seed" | "force" | "check-only";

function parseArgs(argv: string[]): Mode {
  if (argv.includes("--check-only")) return "check-only";
  if (argv.includes("--force")) return "force";
  return "seed";
}

function requireWp(): void {
  const probe = spawnSync("wp", ["--version"], { cwd: ROOT, encoding: "utf8" });
  if (probe.error || probe.status !== 0) {
    throw new Error("wp CLI is required (install global Webpresso CLI)");
  }
}

function readRuntimeConfig(): SecretsConfigMetadata | null {
  const show = spawnSync("wp", ["config", "secrets", "show", "--json"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (show.status !== 0) return null;

  try {
    const payload = JSON.parse(show.stdout) as { config?: Partial<SecretsConfigMetadata> | null };
    const config = payload.config;
    if (!config || (config.manager !== "doppler" && config.manager !== "infisical")) return null;
    if (typeof config.projectId !== "string" || config.projectId.length === 0) return null;
    return {
      manager: config.manager,
      projectId: config.projectId,
      ...(typeof config.projectLabel === "string" ? { projectLabel: config.projectLabel } : {}),
    };
  } catch {
    return null;
  }
}

function configsMatch(left: SecretsConfigMetadata, right: SecretsConfigMetadata): boolean {
  return (
    left.manager === right.manager &&
    left.projectId === right.projectId &&
    (left.projectLabel ?? "") === (right.projectLabel ?? "")
  );
}

function applyViaWp(config: SecretsConfigMetadata): void {
  requireWp();
  const args = ["config", "secrets", "set", config.manager, config.projectId];
  if (config.projectLabel) args.push("--label", config.projectLabel);
  execFileSync("wp", args, { cwd: ROOT, stdio: "inherit" });
}

function main() {
  const mode = parseArgs(process.argv.slice(2));
  if (!existsSync(SOURCE)) {
    console.error(`Missing ${path.relative(ROOT, SOURCE)}`);
    process.exit(1);
  }

  const config = parseSecretsConfigMetadata(readFileSync(SOURCE, "utf8"), path.relative(ROOT, SOURCE));
  if (mode === "check-only") {
    console.log("webpresso secrets config valid (metadata-only, no secret values)");
    return;
  }
  if (process.env.CI === "true" || process.env.CI === "1") {
    console.log("skipping wp secrets default apply in CI");
    return;
  }

  const runtime = readRuntimeConfig();
  if (runtime && configsMatch(runtime, config)) {
    console.log("webpresso secrets config already applied via wp");
    return;
  }
  if (runtime && mode === "seed") {
    console.log("preserving existing wp selection (use --force after updating the committed default)");
    return;
  }

  applyViaWp(config);
  console.log(`Applied repo secrets default via wp (${config.manager}/${config.projectId})`);
}

main();
