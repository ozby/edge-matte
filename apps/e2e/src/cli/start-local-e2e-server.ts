#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { findRepoRoot } from "#repo-root";
import { ensureClientDist } from "#ensure-client-dist";

const requestedPort = Number.parseInt(process.env.E2E_LOCAL_PORT ?? "4173", 10);
const port = Number.isFinite(requestedPort) ? requestedPort : 4173;
const baseUrl = `http://127.0.0.1:${port}`;
const repoRoot = findRepoRoot(import.meta.dirname);
const portFile = join(repoRoot, "apps/e2e/.e2e-base-url");
const persistDir = join(repoRoot, ".wrangler/state/e2e", `${port}-${process.pid}`);

await mkdir(persistDir, { recursive: true });
await ensureClientDist();
await writeFile(portFile, `${baseUrl}\n`, "utf8");

const child = spawn(
  "pnpm",
  [
    "--filter",
    "@edge-matte/worker",
    "exec",
    "wrangler",
    "dev",
    "--local",
    "--port",
    String(port),
    "--ip",
    "127.0.0.1",
    "--persist-to",
    persistDir,
    "--var",
    "APP_ORIGIN:" + baseUrl,
    "--var",
    "E2E_MOCK_PIPELINE:1",
  ],
  {
    stdio: "inherit",
    env: process.env,
    cwd: repoRoot,
  },
);

let shuttingDown = false;

const shutdown = (): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  child.kill("SIGTERM");
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

child.on("exit", (code, signal) => {
  void rm(portFile, { force: true });
  void rm(persistDir, { recursive: true, force: true });
  if (signal) {
    process.exit(0);
  }
  process.exit(code ?? 0);
});

await new Promise(() => undefined);
