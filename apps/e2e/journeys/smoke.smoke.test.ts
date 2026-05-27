import { describe, expect, it } from "vitest";
import { getE2EBaseUrlOrThrow } from "../src/journeys/env";

const baseUrl = getE2EBaseUrlOrThrow("apps/e2e/journeys/smoke.smoke.test.ts");

describe("local smoke coverage", () => {
  it("returns ok from /health", async () => {
    const response = await fetch(new URL("/health", baseUrl));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", version: "0.1.0" });
  });

  it("serves the reviewer-visible SPA shell from /", async () => {
    const response = await fetch(new URL("/", baseUrl));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toMatch(/EdgeMatte/u);
    expect(html).toMatch(/id="app"/u);
    expect(html).toMatch(/assets\/index-.*\.js/u);
  });
});
