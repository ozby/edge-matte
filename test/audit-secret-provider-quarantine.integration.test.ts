import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const scriptPath = resolve("scripts/audit-secret-provider-quarantine.ts");
const DOPPLER_RUN = ["doppler", "run"].join(" ");
const WITH_SECRETS_PROVIDER_FLAG = ["with-secrets", "--doppler"].join(" ");

function withTempDir(run: (cwd: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "edge-matte-secret-quarantine-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runCheck(cwd: string) {
  return spawnSync("bun", [scriptPath], {
    cwd,
    encoding: "utf8",
  });
}

test("passes for neutral workflow docs", () => {
  withTempDir((cwd) => {
    writeFileSync(join(cwd, "README.md"), "Use with-secrets -- vp run dev\n");
    const result = runCheck(cwd);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Secret-provider quarantine: clean/);
  });
});

test("fails when docs/scripts contain direct provider-run usage", () => {
  withTempDir((cwd) => {
    writeFileSync(join(cwd, "README.md"), `run ${DOPPLER_RUN} -- wrangler dev\n`);
    const result = runCheck(cwd);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Secret-provider quarantine violations detected/);
    assert.match(
      result.stderr,
      new RegExp("use `with-secrets -- <cmd>` instead of `" + DOPPLER_RUN + "`"),
    );
  });
});

test("fails when provider-specific with-secrets flag is used", () => {
  withTempDir((cwd) => {
    mkdirSync(join(cwd, "docs"), { recursive: true });
    writeFileSync(
      join(cwd, "docs", "secrets.md"),
      `${WITH_SECRETS_PROVIDER_FLAG} -- vp run dev\n`,
    );
    const result = runCheck(cwd);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /selected-manager `with-secrets -- <cmd>` instead of provider flags/,
    );
  });
});
