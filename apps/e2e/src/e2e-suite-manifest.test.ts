import { describe, expect, it } from "vitest";
import {
  listE2ESuites,
  normalizeE2EPath,
  resolveE2ESuiteForFile,
  resolveE2ESuiteId,
} from "./e2e-suite-manifest";

describe("e2e-suite-manifest", () => {
  it("registers honest smoke, browser, contract, production-smoke, and production-journey suites", () => {
    expect(listE2ESuites().map((suite) => suite.id)).toEqual([
      "smoke",
      "upload-delete",
      "upload-delete-contract",
      "production-smoke",
      "production-journey",
    ]);
  });

  it("resolves suite aliases", () => {
    expect(resolveE2ESuiteId("smoke")).toBe("smoke");
    expect(resolveE2ESuiteId("health")).toBe("smoke");
    expect(resolveE2ESuiteId("upload-delete")).toBe("upload-delete");
    expect(resolveE2ESuiteId("browser")).toBe("upload-delete");
    expect(resolveE2ESuiteId("contract")).toBe("upload-delete-contract");
    expect(resolveE2ESuiteId("production-smoke")).toBe("production-smoke");
    expect(resolveE2ESuiteId("production-journey")).toBe("production-journey");
    expect(resolveE2ESuiteId("prod-journey")).toBe("production-journey");
    expect(resolveE2ESuiteId("missing")).toBeNull();
  });

  it("normalizes journey paths from repo root", () => {
    expect(normalizeE2EPath("journeys/smoke.smoke.test.ts")).toBe(
      "apps/e2e/journeys/smoke.smoke.test.ts",
    );
  });

  it("maps journey files to suites", () => {
    expect(resolveE2ESuiteForFile("apps/e2e/journeys/upload-delete.spec.ts")).toEqual({
      normalizedPath: "apps/e2e/journeys/upload-delete.spec.ts",
      suiteId: "upload-delete",
    });
    expect(resolveE2ESuiteForFile("apps/e2e/journeys/upload-delete.contract.test.ts")).toEqual({
      normalizedPath: "apps/e2e/journeys/upload-delete.contract.test.ts",
      suiteId: "upload-delete-contract",
    });
    expect(resolveE2ESuiteForFile("apps/e2e/journeys/production-smoke.smoke.test.ts")).toEqual({
      normalizedPath: "apps/e2e/journeys/production-smoke.smoke.test.ts",
      suiteId: "production-smoke",
    });
    expect(
      resolveE2ESuiteForFile("apps/e2e/journeys/production-journey.smoke.test.ts"),
    ).toEqual({
      normalizedPath: "apps/e2e/journeys/production-journey.smoke.test.ts",
      suiteId: "production-journey",
    });
  });
});
