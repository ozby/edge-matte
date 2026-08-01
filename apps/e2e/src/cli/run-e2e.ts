#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { buildExecutionPlan } from "#webpresso-host-adapter";
import { findRepoRoot } from "#repo-root";

const resolveSuiteArg = (): string | undefined => {
  const argv = process.argv.slice(2);
  const equalsForm = argv.find((arg) => arg.startsWith("--suite="));
  if (equalsForm) return equalsForm.slice("--suite=".length);
  const flagIndex = argv.findIndex((arg) => arg === "--suite");
  if (flagIndex >= 0 && argv[flagIndex + 1]) return argv[flagIndex + 1];
  return undefined;
};

const suite = resolveSuiteArg();

const batches = buildExecutionPlan({ suite });
if (batches.length === 0) {
  console.error("No e2e suites matched the request.");
  process.exit(1);
}

const repoRoot = findRepoRoot(import.meta.dirname);

for (const batch of batches) {
  console.log(`e2e batch: ${batch.batchKey}`);
  for (const run of batch.runs) {
    console.log(
      `  ${run.suiteId}/${run.logName} [${run.runner}]: ${run.command} ${run.args.join(" ")}`,
    );
    const result = spawnSync(run.command, run.args, {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

console.log("e2e runner: all requested suites passed.");
