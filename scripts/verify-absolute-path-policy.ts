#!/usr/bin/env bun
/**
 * Standalone absolute-path policy audit (no wp CLI required).
 * Mirrors @webpresso/agent-kit `audit absolute-path-policy` for public CI clones.
 */
import { auditAbsolutePathPolicy } from "./lib/absolute-path-policy.ts";

const result = auditAbsolutePathPolicy(process.cwd());

if (result.ok) {
  console.log(`OK: absolute path policy (${result.checked} files scanned)`);
  process.exit(0);
}

for (const violation of result.violations) {
  console.error(`${violation.file}: ${violation.message}`);
}
console.error(`absolute path policy failed (${result.violations.length} violation(s))`);
process.exit(1);
