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
        command: "pnpm",
        args: [
          "exec",
          "playwright",
          "test",
          "--config",
          "playwright.config.mjs",
          "journeys/upload-delete.spec.mjs",
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
        command: "pnpm",
        args: [
          "exec",
          "vitest",
          "run",
          "--config",
          "vitest.journeys.config.ts",
          "journeys/upload-delete.contract.test.ts",
        ],
      }),
    ]);
  });
});
