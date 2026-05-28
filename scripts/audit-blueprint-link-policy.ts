#!/usr/bin/env bun

import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectBlueprintLinkViolations } from "./lib/audit-blueprint-link-policy.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = collectBlueprintLinkViolations({ root: REPO_ROOT });

if (violations.length > 0) {
  console.error("Blueprint link policy violations detected:\n");
  for (const violation of violations) {
    const targetSuffix = violation.target ? ` "${violation.target}"` : "";
    console.error(`- ${violation.file}:${violation.line} ${violation.message}${targetSuffix}`);
  }
  process.exit(1);
}

console.log("Blueprint link policy: clean.");
