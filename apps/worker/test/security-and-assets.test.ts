import { describe, expect, it, vi } from "vitest";
import { createApp } from "#adapters/hono/app";
import { SEGMENT_TMP_PREFIX } from "#core/object-keys";
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

describe("internal raw-serving gate (/internal/raw/:key)", () => {
  // A bucket holding both a transient cf.image blob AND the kind of private objects
  // (job metadata, original uploads) that must NEVER be reachable through this route.
  const SEGMENT_KEY = `${SEGMENT_TMP_PREFIX}123-abc`;
  const rawBucketStub = () => {
    const objects = new Map<string, string>([
      [SEGMENT_KEY, "transient-cutout-bytes"],
      ["jobs/job_secret.json", '{"deleteTokenHash":"leaked"}'],
      ["images/job_secret/original", "private-original-bytes"],
    ]);
    return {
      async get(key: string) {
        const body = objects.get(key);
        if (body === undefined) return null;
        return { body, httpMetadata: { contentType: "image/png" } };
      },
    } as unknown as R2Bucket;
  };

  const fetchRaw = (key: string) =>
    createApp({ ...stubDeps(), rawBucket: rawBucketStub() }).fetch(
      new Request(`https://edge-matte.ozby.dev/internal/raw/${encodeURIComponent(key)}`),
    );

  it("serves a transient segment-tmp object so the cf.image sub-request can read it", async () => {
    const response = await fetchRaw(SEGMENT_KEY);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("transient-cutout-bytes");
  });

  it("rejects private job metadata even when the object exists in the bucket", async () => {
    const response = await fetchRaw("jobs/job_secret.json");
    expect(response.status).toBe(404);
    // The deleteTokenHash must never leak through this route.
    expect(await response.text()).not.toContain("leaked");
  });

  it("rejects original uploads even when the object exists in the bucket", async () => {
    const response = await fetchRaw("images/job_secret/original");
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("private-original-bytes");
  });

  it("returns 404 for a missing segment-tmp key", async () => {
    const response = await fetchRaw(`${SEGMENT_TMP_PREFIX}does-not-exist`);
    expect(response.status).toBe(404);
  });

  it("returns 404 when no raw bucket is wired (in-memory dev/test path)", async () => {
    const response = await createApp(stubDeps()).fetch(
      new Request(`https://edge-matte.ozby.dev/internal/raw/${encodeURIComponent(SEGMENT_KEY)}`),
    );
    expect(response.status).toBe(404);
  });
});
