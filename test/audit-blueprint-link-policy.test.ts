import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  collectBlueprintLinkViolations,
  validateMarkdownLinkTarget,
} from "../scripts/lib/audit-blueprint-link-policy.ts";

const scriptPath = resolve("scripts/audit-blueprint-link-policy.ts");

function withTempBlueprintDir(run: (root: string, blueprintDir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "edge-matte-blueprint-links-"));
  const blueprintDir = join(dir, "blueprints", "planned");
  mkdirSync(blueprintDir, { recursive: true });
  try {
    run(dir, blueprintDir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("validateMarkdownLinkTarget accepts relative and cross-repo links", () => {
  assert.equal(validateMarkdownLinkTarget("#section"), null);
  assert.equal(validateMarkdownLinkTarget("./completed/foo.md"), null);
  assert.equal(validateMarkdownLinkTarget("../../docs/architecture.md"), null);
  assert.equal(validateMarkdownLinkTarget("2026-05-27-edge-matte.md"), null);
  assert.equal(
    validateMarkdownLinkTarget(
      "https://github.com/webpresso/agent-kit/blob/main/skills/plan-refine/SKILL.md",
    ),
    null,
  );
});

test("validateMarkdownLinkTarget rejects local file and same-repo GitHub URLs", () => {
  const fileScheme = validateMarkdownLinkTarget("file:../docs/architecture.md");
  assert.ok(fileScheme);
  assert.match(fileScheme, /local file link target/);

  const sameRepo = validateMarkdownLinkTarget(
    "https://github.com/ozby/edge-matte/blob/main/docs/architecture.md",
  );
  assert.ok(sameRepo);
  assert.match(sameRepo, /same-repo GitHub URL/);

  const absolutePath = validateMarkdownLinkTarget("/docs/architecture.md");
  assert.ok(absolutePath);
  assert.match(absolutePath, /absolute path link target/);
});

test("collectBlueprintLinkViolations scans all blueprint markdown files", () => {
  withTempBlueprintDir((root, blueprintDir) => {
    writeFileSync(join(blueprintDir, "good.md"), "[Architecture](../../docs/architecture.md)\n");
    writeFileSync(
      join(root, "blueprints", "README.md"),
      "[Agent kit](https://github.com/webpresso/agent-kit/blob/main/README.md)\n",
    );
    writeFileSync(
      join(blueprintDir, "bad.md"),
      "[Architecture](https://github.com/ozby/edge-matte/blob/main/docs/architecture.md)\n",
    );

    const violations = collectBlueprintLinkViolations({ root });
    assert.equal(violations.length, 1);
    assert.match(violations[0].file, /planned\/bad\.md$/);
    assert.match(violations[0].message, /same-repo GitHub URL/);
  });
});

test("collectBlueprintLinkViolations flags file scheme targets", () => {
  withTempBlueprintDir((root, blueprintDir) => {
    writeFileSync(join(blueprintDir, "bad.md"), "[Docs](file:../docs/architecture.md)\n");

    const violations = collectBlueprintLinkViolations({ root });
    assert.equal(violations.length, 1);
    assert.match(violations[0].message, /local file link target/);
  });
});

test("collectBlueprintLinkViolations flags bare file scheme mentions outside links", () => {
  withTempBlueprintDir((root, blueprintDir) => {
    writeFileSync(
      join(blueprintDir, "bad.md"),
      "Do not use file:../docs/architecture.md in docs.\n",
    );

    const violations = collectBlueprintLinkViolations({ root });
    assert.equal(violations.length, 1);
    assert.match(violations[0].message, /local file scheme path detected/);
  });
});

test("repo blueprint link audit passes", () => {
  const result = spawnSync("bun", [scriptPath], {
    cwd: resolve("."),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Blueprint link policy: clean/);
});
