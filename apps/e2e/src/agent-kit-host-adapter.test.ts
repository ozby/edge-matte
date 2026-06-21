import { describe, expect, it } from "vitest";
import { buildExecutionPlan } from "./agent-kit-host-adapter";

describe("agent-kit-host-adapter", () => {
  it("routes reviewer-critical upload-delete through Playwright", () => {
    const [batch] = buildExecutionPlan({ suite: "upload-delete" });
    expect(batch.batchKey).toBe("upload-delete");
    expect(batch.runs).toEqual([
      expect.objectContaining({
        suiteId: "upload-delete",
        runner: "playwright",
        command: "vp",
        args: [
          "exec",
          "--workspace-root",
          "--",
          "playwright",
          "test",
          "--config",
          "apps/e2e/playwright.config.ts",
          "apps/e2e/journeys/upload-delete.spec.ts",
        ],
      }),
    ]);
  });

  it("keeps upload-delete contract coverage on Vitest with honest naming", () => {
    const [batch] = buildExecutionPlan({ suite: "upload-delete-contract" });
    expect(batch.batchKey).toBe("upload-delete-contract");
    expect(batch.runs).toEqual([
      expect.objectContaining({
        suiteId: "upload-delete-contract",
        runner: "vitest",
        command: "vp",
        args: [
          "exec",
          "--workspace-root",
          "--",
          "vitest",
          "run",
          "--config",
          "apps/e2e/vitest.journeys.config.ts",
          "apps/e2e/journeys/upload-delete.contract.test.ts",
        ],
      }),
    ]);
  });
});
