import { mkdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { findRepoRoot } from "#repo-root";

const repoRoot = findRepoRoot(import.meta.dirname);
const distDir = join(repoRoot, "apps/client/dist");
const distIndex = join(distDir, "index.html");
const lockDir = join(repoRoot, "apps/e2e/.client-build-lock");

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function waitForDist(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await pathExists(distIndex)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for apps/client/dist at ${distIndex}`);
}

export async function ensureClientDist(): Promise<void> {
  if (existsSync(distIndex)) {
    return;
  }

  try {
    await mkdir(lockDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      await waitForDist(120_000);
      return;
    }
    throw error;
  }

  try {
    const build = spawnSync("pnpm", ["--filter", "@edge-matte/client", "run", "build"], {
      cwd: repoRoot,
      stdio: "inherit",
      env: process.env,
    });
    if (build.status !== 0) {
      throw new Error(`Failed to build client dist (exit ${build.status ?? 1})`);
    }
  } finally {
    await rm(lockDir, { recursive: true, force: true });
  }
}

export default ensureClientDist;
