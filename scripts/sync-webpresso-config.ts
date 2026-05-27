#!/usr/bin/env bun
/**
 * Apply committed `.webpresso/secrets.config.json` via `wp config secrets set`.
 * When wp is unavailable (CI), writes metadata to `.git/webpresso/secrets.json`.
 * Secret values stay in Doppler/Cloudflare; committed config is metadata only.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

function wpAvailable(): boolean {
  const probe = spawnSync("wp", ["--version"], { cwd: ROOT, encoding: "utf8" });
  return !probe.error && probe.status === 0;
}

function runtimeConfigPath(root: string): string {
  return path.join(root, ".git", "webpresso", "secrets.json");
}

function readRuntimeConfigFromDisk(root: string): SecretsConfigMetadata | null {
  const runtimePath = runtimeConfigPath(root);
  if (!existsSync(runtimePath)) return null;
  try {
    return parseSecretsConfigMetadata(
      readFileSync(runtimePath, "utf8"),
      path.relative(root, runtimePath),
    );
  } catch {
    return null;
  }
}

function writeRuntimeConfigToDisk(root: string, config: SecretsConfigMetadata): void {
  const runtimePath = runtimeConfigPath(root);
  mkdirSync(path.dirname(runtimePath), { recursive: true });
  writeFileSync(runtimePath, `${JSON.stringify(config, null, 2)}\n`);
}

function readRuntimeConfigFromWp(): SecretsConfigMetadata | null {
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

function readRuntimeConfig(): SecretsConfigMetadata | null {
  if (wpAvailable()) {
    const fromWp = readRuntimeConfigFromWp();
    if (fromWp) return fromWp;
  }
  return readRuntimeConfigFromDisk(ROOT);
}

function configsMatch(left: SecretsConfigMetadata, right: SecretsConfigMetadata): boolean {
  return (
    left.manager === right.manager &&
    left.projectId === right.projectId &&
    (left.projectLabel ?? "") === (right.projectLabel ?? "")
  );
}

function applyViaWp(config: SecretsConfigMetadata): void {
  const args = ["config", "secrets", "set", config.manager, config.projectId];
  if (config.projectLabel) args.push("--label", config.projectLabel);
  execFileSync("wp", args, { cwd: ROOT, stdio: "inherit" });
}

function applyConfig(config: SecretsConfigMetadata, mode: Mode): void {
  const runtime = readRuntimeConfig();
  if (runtime && configsMatch(runtime, config)) {
    console.log("webpresso secrets config already applied");
    return;
  }
  if (runtime && mode === "seed") {
    console.log(
      "preserving existing wp selection (use --force after updating the committed default)",
    );
    return;
  }

  if (wpAvailable()) {
    applyViaWp(config);
    console.log(`Applied repo secrets default via wp (${config.manager}/${config.projectId})`);
    return;
  }

  writeRuntimeConfigToDisk(ROOT, config);
  console.log(
    `Applied repo secrets default to ${path.relative(ROOT, runtimeConfigPath(ROOT))} (wp unavailable)`,
  );
}

function main() {
  const mode = parseArgs(process.argv.slice(2));
  if (!existsSync(SOURCE)) {
    console.error(`Missing ${path.relative(ROOT, SOURCE)}`);
    process.exit(1);
  }

  const config = parseSecretsConfigMetadata(
    readFileSync(SOURCE, "utf8"),
    path.relative(ROOT, SOURCE),
  );
  if (mode === "check-only") {
    console.log("webpresso secrets config valid (metadata-only, no secret values)");
    return;
  }

  applyConfig(config, mode);
}

main();
