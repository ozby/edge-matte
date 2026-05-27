#!/usr/bin/env bun
/**
 * Verify secret values and secret carrier files never land in the repo tree or git index.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  isForbiddenGitPath,
  isForbiddenWorkingTreePath,
  parseSecretsConfigMetadata,
  SECRET_VALUE_PATTERN,
  SECRETS_CONFIG_PATH,
  shouldScanGitFileForSecretValues,
} from "./lib/secrets-policy.ts";

const ROOT = process.cwd();
const SKIP_DIRS = new Set([".git", "node_modules", ".wrangler"]);
const violations: string[] = [];

function walkWorkingTree(dir: string): void {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true }).map((entry) => entry.name);
  } catch {
    return;
  }

  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;

    const fullPath = join(dir, name);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      walkWorkingTree(fullPath);
      continue;
    }
    if (!stat.isFile()) continue;

    const relPath = relative(ROOT, fullPath);
    if (isForbiddenWorkingTreePath(relPath)) {
      violations.push(`forbidden secret carrier on disk: ${relPath}`);
    }
  }
}

function listTrackedFiles(): string[] {
  try {
    const out = execFileSync("git", ["ls-files", "-z"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\0").filter(Boolean);
  } catch {
    console.error("ERROR: verify-secrets-policy requires a git repository.");
    process.exit(1);
  }
}

function verifyGitIndex(): void {
  if (!existsSync(join(ROOT, ".git"))) {
    return;
  }

  for (const relPath of listTrackedFiles()) {
    if (isForbiddenGitPath(relPath)) {
      violations.push(`tracked forbidden secret carrier: ${relPath}`);
      continue;
    }

    const fullPath = join(ROOT, relPath);
    if (!existsSync(fullPath)) {
      continue;
    }

    if (relPath === SECRETS_CONFIG_PATH) {
      try {
        parseSecretsConfigMetadata(readFileSync(fullPath, "utf8"), relPath);
      } catch (error) {
        violations.push(error instanceof Error ? error.message : String(error));
      }
      continue;
    }

    if (!shouldScanGitFileForSecretValues(relPath)) {
      continue;
    }

    if (SECRET_VALUE_PATTERN.test(readFileSync(fullPath, "utf8"))) {
      violations.push(`tracked file contains secret-like value pattern: ${relPath}`);
    }
  }
}

walkWorkingTree(ROOT);
verifyGitIndex();

if (violations.length > 0) {
  console.error("ERROR: secret values or secret carrier files must not touch disk or git:\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("OK: no secret carriers or secret-like values in working tree or git");
