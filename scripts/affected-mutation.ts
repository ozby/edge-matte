#!/usr/bin/env bun
import { spawnSync } from "node:child_process";

import { findRepoRoot } from "./lib/find-repo-root";

const result = spawnSync("vp", ["run", "test:mutation"], {
  cwd: findRepoRoot(import.meta.dirname),
  shell: false,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
