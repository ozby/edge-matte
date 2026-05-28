import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export const SAME_REPO_GITHUB_URL_PATTERN =
  /^https:\/\/github\.com\/ozby\/edge-matte(?:\/blob|\/tree|\/raw)\//iu;

export const LOCAL_FILE_SCHEME_PATTERN = /\bfile:(?:\/\/)?(?:\.\.?\/|\/|[A-Za-z]:\\|\\\\)/iu;

export const MARKDOWN_LINK_PATTERN = /\[[^\]]+\]\(([^)]+)\)/gu;

export type BlueprintLinkViolation = {
  file: string;
  line: number;
  message: string;
  target?: string;
};

export function validateMarkdownLinkTarget(target: string): string | null {
  const trimmed = target.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  if (trimmed.toLowerCase().startsWith("file:")) {
    return "local file link target — use a relative same-repo path or cross-repo GitHub URL";
  }

  if (SAME_REPO_GITHUB_URL_PATTERN.test(trimmed)) {
    return "same-repo GitHub URL — use a relative link from the blueprint file";
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return "absolute path link target — use a relative same-repo path";
  }

  return null;
}

export function collectBlueprintLinkViolations(input: {
  root: string;
  blueprintDir?: string;
}): BlueprintLinkViolation[] {
  const blueprintDir = input.blueprintDir ?? path.join(input.root, "blueprints");
  const violations: BlueprintLinkViolation[] = [];

  for (const relPath of listMarkdownFiles(blueprintDir, blueprintDir)) {
    const absolutePath = path.join(blueprintDir, relPath);
    const content = readFileSync(absolutePath, "utf8");
    const lines = content.split("\n");
    const displayPath = path.posix.join("blueprints", relPath.split(path.sep).join("/"));

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      let lineHasFileLinkTarget = false;

      for (const match of line.matchAll(MARKDOWN_LINK_PATTERN)) {
        const target = (match[1] ?? "").trim();
        if (target.toLowerCase().startsWith("file:")) {
          lineHasFileLinkTarget = true;
        }
        const message = validateMarkdownLinkTarget(target);
        if (message) {
          violations.push({
            file: displayPath,
            line: index + 1,
            message,
            target,
          });
        }
      }

      if (!lineHasFileLinkTarget && LOCAL_FILE_SCHEME_PATTERN.test(line)) {
        violations.push({
          file: displayPath,
          line: index + 1,
          message: "local file scheme path detected",
        });
      }
    }
  }

  return violations;
}

function listMarkdownFiles(dir: string, root: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      files.push(...listMarkdownFiles(absolute, root));
      continue;
    }
    if (entry.endsWith(".md")) {
      files.push(path.relative(root, absolute));
    }
  }

  return files.sort();
}
