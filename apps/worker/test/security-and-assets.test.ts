import { describe, expect, it, vi } from "vitest";
import { createApp } from "#adapters/hono/app";
import type { ProcessImageJobDeps } from "#core/process-image-job";

// Minimal deps stub — these tests only exercise the middleware + catch-all,
// never the pipeline, so the ports can be no-ops.
const stubDeps = (): ProcessImageJobDeps & { appOrigin: string } => ({
  appOrigin: "https://edge-matte.ozby.dev",
  repository: {
    async create() {},
    async update() {},
    async get() {
      return null;
    },
    async delete() {},
  },
  objectStore: {
    async putOriginal() {},
    async putProcessed() {},
    async getProcessed() {
      return null;
    },
    async deleteAll() {},
  },
  provider: {
    async removeBackground(input) {
      return input;
    },
  },
  transformer: {
    async flipHorizontal(input) {
      return new Response(input.stream());
    },
  },
});

const EXPECTED_HEADER_KEYS = [
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];

describe("security headers", () => {
  it("applies all baseline security headers to API responses", async () => {
    const app = createApp(stubDeps());
    const response = await app.fetch(new Request("https://edge-matte.ozby.dev/health"));

    expect(response.status).toBe(200);
    for (const key of EXPECTED_HEADER_KEYS) {
      expect(response.headers.get(key)).not.toBeNull();
    }
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    // No third-party font origins — fonts are self-hosted via @fontsource.
    expect(response.headers.get("content-security-policy")).not.toContain("fonts.googleapis.com");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("static asset delegation (run_worker_first)", () => {
  it("proxies unmatched routes to the ASSETS binding and applies security headers", async () => {
    const assetBody = "<!doctype html><title>EdgeMatte</title>";
    const assets: Fetcher = {
      fetch: vi.fn(
        async () =>
          new Response(assetBody, {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
      ),
    } as unknown as Fetcher;

    const app = createApp({ ...stubDeps(), assets });
    const response = await app.fetch(new Request("https://edge-matte.ozby.dev/"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(assetBody);
    expect(assets.fetch).toHaveBeenCalledOnce();
    // The middleware must reconstruct the asset response so headers apply even
    // though Workers Static Assets returns immutable-header Responses.
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it("falls back to a placeholder when no ASSETS binding is wired (in-memory dev)", async () => {
    const app = createApp(stubDeps());
    const response = await app.fetch(new Request("https://edge-matte.ozby.dev/some/spa/route"));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("EdgeMatte");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
  });
});

describe("internal route isolation", () => {
  it("hard-rejects /internal/* paths instead of falling through to the SPA shell", async () => {
    const response = await createApp(stubDeps()).fetch(
      new Request("https://edge-matte.ozby.dev/internal/raw/anything"),
    );
    expect(response.status).toBe(404);
  });
});
