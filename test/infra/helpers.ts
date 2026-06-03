import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { findRepoRoot } from "#scripts/lib/find-repo-root.ts";

export const root = findRepoRoot(import.meta.dirname);
export const PRODUCTION_DOMAIN = "edge-matte.ozby.dev";
export const PRODUCTION_ORIGIN = `https://${PRODUCTION_DOMAIN}`;
export const R2_BUCKET_NAME = "edge-matte-images";

export function readText(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

/** Return trimmed lines for a TOML table header like `[images]` or `[env.production]`. */
export function sectionLines(text: string, header: string): string[] | null {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) {
    return null;
  }

  const collected = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*\[/.test(line)) {
      break;
    }
    collected.push(line);
  }
  return collected;
}

/** Collect body lines for each `[[array-table]]` occurrence (e.g. routes, r2_buckets). */
export function arrayTableBlocks(text: string, header: string): string[][] {
  const lines = text.split("\n");
  const blocks: string[][] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim() !== header) {
      i += 1;
      continue;
    }

    const block: string[] = [];
    i += 1;
    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*\[\[/.test(line) || /^\s*\[[^[]/.test(line)) {
        break;
      }
      block.push(line);
      i += 1;
    }
    blocks.push(block);
  }

  return blocks;
}

export function blockHasAssignment(
  block: string[],
  key: string,
  valuePattern: RegExp | string,
): boolean {
  const pattern =
    valuePattern instanceof RegExp
      ? new RegExp(`^\\s*${key}\\s*=\\s*${valuePattern.source}`, "u")
      : new RegExp(`^\\s*${key}\\s*=\\s*${quoteTomlValue(valuePattern)}\\s*$`, "u");

  return block.some((line: string) => pattern.test(line));
}

function quoteTomlValue(value: string) {
  return `"${String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`;
}
