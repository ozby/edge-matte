import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".agent",
  ".agents",
  ".claude",
  ".codex",
  ".cursor",
  ".gemini",
  ".omc",
  ".omx",
  ".opencode",
  ".windsurf",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
  "docs",
  "catalog",
  "blueprints",
  "logs",
  "reports",
  "fixtures",
  "__fixtures__",
  "test-fixtures",
]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);
const TEST_FILE_MARKERS = [".test.", ".spec.", ".integration.test."];
const HARD_CODED_RELATIVE_FILESYSTEM_PATH_PATTERNS = [
  /(?:[A-Za-z_$][\w$]*\.)?(?:resolve|join)\s*\(\s*(?:import\.meta\.dirname|__dirname|process\.cwd\(\))\s*,\s*["'](?:\.\.?\/)+/u,
  /(?:[A-Za-z_$][\w$]*\.)?(?:resolve|join)\s*\(\s*(?:import\.meta\.dirname|__dirname|process\.cwd\(\))\s*,\s*["']\.\.?["']/u,
  /new\s+URL\(\s*["'](?:\.\.?\/)+[^"']*["']\s*,\s*import\.meta\.url\s*\)/u,
] as const;

export type AbsolutePathViolation = {
  file: string;
  message: string;
};

export function shouldScanAbsolutePathPolicyPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/gu, "/");
  if (TEST_FILE_MARKERS.some((marker) => normalized.includes(marker))) return false;
  if (normalized.endsWith(".d.ts")) return false;
  const extensionIndex = normalized.lastIndexOf(".");
  const extension = extensionIndex === -1 ? "" : normalized.slice(extensionIndex);
  return SCAN_EXTENSIONS.has(extension);
}

export function findAbsolutePathPolicyViolationsInText(
  relativePath: string,
  text: string,
): AbsolutePathViolation[] {
  const violations: AbsolutePathViolation[] = [];
  const lines = text.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;
    if (!HARD_CODED_RELATIVE_FILESYSTEM_PATH_PATTERNS.some((pattern) => pattern.test(line))) {
      continue;
    }
    violations.push({
      file: relativePath,
      message: `hardcoded relative filesystem path at line ${index + 1}; derive an absolute path from an explicit repo/package/runtime anchor instead`,
    });
  }

  return violations;
}

export function auditAbsolutePathPolicy(rootDirectory: string = process.cwd()): {
  ok: boolean;
  checked: number;
  violations: AbsolutePathViolation[];
} {
  const root = resolve(rootDirectory);
  const violations: AbsolutePathViolation[] = [];

  const walk = (directory: string): number => {
    let checked = 0;

    for (const entry of readdirSync(directory)) {
      if (SKIP_DIRS.has(entry)) continue;

      const fullPath = join(directory, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        checked += walk(fullPath);
        continue;
      }
      if (!stat.isFile()) continue;

      const relativePath = relative(root, fullPath).replace(/\\/gu, "/");
      if (!shouldScanAbsolutePathPolicyPath(relativePath)) continue;

      checked += 1;
      const text = readFileSync(fullPath, "utf8");
      violations.push(...findAbsolutePathPolicyViolationsInText(relativePath, text));
    }

    return checked;
  };

  const checked = walk(root);
  return { ok: violations.length === 0, checked, violations };
}
