import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";

import {
  SECRETS_CONFIG_PATH,
  isForbiddenGitPath,
  isForbiddenWorkingTreePath,
  parseSecretsConfigMetadata,
  shouldScanGitFileForSecretValues,
  SECRET_VALUE_PATTERN,
} from "./lib/secrets-policy.js";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

const failures: string[] = [];

function runGit(args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

function listNullDelimited(output: string): string[] {
  return output.split("\0").filter(Boolean);
}

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function report(message: string): void {
  failures.push(message);
}

const configPath = resolve(repoRoot, SECRETS_CONFIG_PATH);
if (!existsSync(configPath)) {
  report(`${SECRETS_CONFIG_PATH} is required`);
} else {
  try {
    parseSecretsConfigMetadata(readRepoFile(SECRETS_CONFIG_PATH), SECRETS_CONFIG_PATH);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    report(detail);
  }
}

for (const trackedPath of listNullDelimited(runGit(["ls-files", "-z"]))) {
  if (isForbiddenGitPath(trackedPath)) {
    report(`tracked forbidden secret carrier path: ${trackedPath}`);
    continue;
  }

  if (!shouldScanGitFileForSecretValues(trackedPath)) {
    continue;
  }

  const absolutePath = resolve(repoRoot, trackedPath);
  if (!existsSync(absolutePath)) {
    continue;
  }
  const contents = readFileSync(absolutePath, "utf8");
  if (SECRET_VALUE_PATTERN.test(contents)) {
    report(`tracked file contains a secret-like value: ${trackedPath}`);
  }
}

for (const workingPath of listNullDelimited(
  runGit(["ls-files", "-z", "--others", "--exclude-standard"]),
)) {
  if (isForbiddenWorkingTreePath(workingPath)) {
    report(`working tree contains forbidden secret carrier path: ${workingPath}`);
  }
}

for (const candidate of [".webpresso/secrets.json", ".dev.vars", ".dev.vars.example"]) {
  const absolutePath = resolve(repoRoot, candidate);
  if (existsSync(absolutePath) && isForbiddenWorkingTreePath(relative(repoRoot, absolutePath))) {
    report(`working tree contains forbidden secret carrier path: ${candidate}`);
  }
}

if (failures.length > 0) {
  console.error("secrets policy failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("repo secrets policy passed");
