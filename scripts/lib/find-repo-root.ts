import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const REPO_ROOT_MARKERS = ["package.json", "pnpm-workspace.yaml", "AGENTS.md"];

function hasRepoMarkers(dir: string): boolean {
  return REPO_ROOT_MARKERS.every((marker) => existsSync(join(dir, marker)));
}

export function findRepoRoot(startDir = process.cwd()): string {
  let current = resolve(startDir);

  while (true) {
    if (hasRepoMarkers(current)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error(
        `Could not find repo root from ${startDir}. Expected markers: ${REPO_ROOT_MARKERS.join(", ")}`,
      );
    }
    current = parent;
  }
}

export default findRepoRoot;
