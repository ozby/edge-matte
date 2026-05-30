import { afterEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.fn();
const ensureClientDistMock = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

vi.mock("./ensure-client-dist", () => ({
  ensureClientDist: ensureClientDistMock,
}));

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
  vi.clearAllMocks();
});

describe("global e2e setup", () => {
  it("skips local wrangler boot for production journeys", async () => {
    process.env.E2E_RUN_PRODUCTION = "1";
    delete process.env.E2E_BASE_URL;

    const module = await import("../global-setup.ts");
    const teardown = await module.default();

    expect(ensureClientDistMock).not.toHaveBeenCalled();
    expect(spawnMock).not.toHaveBeenCalled();

    await expect(teardown()).resolves.toBeUndefined();
  });
});
