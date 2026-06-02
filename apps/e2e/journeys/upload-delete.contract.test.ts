import { describe, expect, it } from "vitest";
import { readSamplePng } from "#fixtures";
import { getE2EBaseUrlOrThrow } from "../src/journeys/env";

const baseUrl = getE2EBaseUrlOrThrow("apps/e2e/journeys/upload-delete.contract.test.ts");
const SAMPLE_PNG = readSamplePng();

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47] as const;

type CreatedJob = {
  id: string;
  status: string;
  imageUrl: string;
  originalImageUrl: string;
  resultUrl: string;
  pollUrl: string;
  deleteToken: string;
};

const uploadSample = async (): Promise<CreatedJob> => {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(SAMPLE_PNG)], "contract.png", { type: "image/png" }));
  const response = await fetch(new URL("/api/jobs", baseUrl), { method: "POST", body: form });
  expect(response.status).toBe(201);
  return (await response.json()) as CreatedJob;
};

const errorCode = async (response: Response): Promise<string> => {
  const body = (await response.json()) as { error?: { code?: string } };
  return body.error?.code ?? "";
};

describe("upload-delete API contract — happy path", () => {
  it("uploads, serves a valid hosted PNG, then deletes to 404", async () => {
    const created = await uploadSample();
    expect(created.status).toBe("ready");
    expect(created.imageUrl).toContain(`/i/${created.id}`);
    expect(created.originalImageUrl).toContain(`/i/${created.id}/original`);
    expect(created.resultUrl).toContain(`/r/${created.id}`);
    expect(created.pollUrl).toContain(`/api/jobs/${created.id}`);
    expect(created.deleteToken.length).toBeGreaterThan(0);

    const statusResponse = await fetch(new URL(`/api/jobs/${created.id}`, baseUrl));
    expect(statusResponse.status).toBe(200);
    expect(await statusResponse.json()).toMatchObject({
      id: created.id,
      imageUrl: created.imageUrl,
      originalImageUrl: created.originalImageUrl,
      resultUrl: created.resultUrl,
    });

    const imageResponse = await fetch(new URL(`/i/${created.id}`, baseUrl));
    expect(imageResponse.status).toBe(200);
    expect(imageResponse.headers.get("content-type")).toMatch(/image\//u);
    expect(imageResponse.headers.get("cache-control")).toBe("no-store");
    const imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
    expect(imageBytes.length).toBeGreaterThan(0);
    // Valid PNG magic. (In mock mode the pipeline is a pass-through, so the body is
    // byte-identical to the input — transform difference is asserted by production-journey.)
    expect(Array.from(imageBytes.slice(0, 4))).toStrictEqual([...PNG_MAGIC]);

    const originalResponse = await fetch(new URL(`/i/${created.id}/original`, baseUrl));
    expect(originalResponse.status).toBe(200);
    expect(originalResponse.headers.get("content-type")).toMatch(/image\//u);
    expect(originalResponse.headers.get("cache-control")).toBe("no-store");
    const originalBytes = new Uint8Array(await originalResponse.arrayBuffer());
    expect(Array.from(originalBytes.slice(0, 4))).toStrictEqual([...PNG_MAGIC]);

    const deleteResponse = await fetch(new URL(`/api/jobs/${created.id}`, baseUrl), {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deleteToken: created.deleteToken }),
    });
    expect(deleteResponse.status).toBe(204);

    expect((await fetch(new URL(`/i/${created.id}`, baseUrl))).status).toBe(404);
    expect((await fetch(new URL(`/i/${created.id}/original`, baseUrl))).status).toBe(404);
    expect((await fetch(new URL(`/api/jobs/${created.id}`, baseUrl))).status).toBe(404);
  });
});

describe("upload-delete API contract — error envelopes", () => {
  it("rejects an oversized upload with 413 file_too_large", async () => {
    const oversized = new Uint8Array(8 * 1024 * 1024 + 1);
    oversized.set(SAMPLE_PNG, 0);
    const form = new FormData();
    form.set("file", new File([oversized], "big.png", { type: "image/png" }));
    const response = await fetch(new URL("/api/jobs", baseUrl), { method: "POST", body: form });
    expect(response.status).toBe(413);
    expect(await errorCode(response)).toBe("file_too_large");
  });

  it("rejects an unsupported media type with 415", async () => {
    const form = new FormData();
    form.set("file", new File(["not an image"], "note.txt", { type: "text/plain" }));
    const response = await fetch(new URL("/api/jobs", baseUrl), { method: "POST", body: form });
    expect(response.status).toBe(415);
    expect(await errorCode(response)).toBe("unsupported_media_type");
  });

  it("rejects an upload with no file as 400 invalid_request", async () => {
    const response = await fetch(new URL("/api/jobs", baseUrl), {
      method: "POST",
      body: new FormData(),
    });
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_request");
  });

  it("rejects a wrong delete token with 401 invalid_delete_token", async () => {
    const created = await uploadSample();
    const response = await fetch(new URL(`/api/jobs/${created.id}`, baseUrl), {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deleteToken: "wrong-token" }),
    });
    expect(response.status).toBe(401);
    expect(await errorCode(response)).toBe("invalid_delete_token");
    // Cleanup.
    await fetch(new URL(`/api/jobs/${created.id}`, baseUrl), {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deleteToken: created.deleteToken }),
    });
  });

  it("rejects a delete with no token as 400 invalid_request", async () => {
    const created = await uploadSample();
    const response = await fetch(new URL(`/api/jobs/${created.id}`, baseUrl), {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_request");
    await fetch(new URL(`/api/jobs/${created.id}`, baseUrl), {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deleteToken: created.deleteToken }),
    });
  });

  it("returns 404 image_not_found for unknown ids", async () => {
    expect((await fetch(new URL("/api/jobs/job_missing", baseUrl))).status).toBe(404);
    expect((await fetch(new URL("/i/job_missing", baseUrl))).status).toBe(404);
    expect((await fetch(new URL("/i/job_missing/original", baseUrl))).status).toBe(404);
    const del = await fetch(new URL("/api/jobs/job_missing", baseUrl), {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deleteToken: "anything" }),
    });
    expect(del.status).toBe(404);
    expect(await errorCode(del)).toBe("image_not_found");
  });
});

describe("upload-delete API contract — security headers and SPA delegation", () => {
  it("applies baseline security headers to API responses", async () => {
    const response = await fetch(new URL("/health", baseUrl));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).not.toBeNull();
    expect(response.headers.get("permissions-policy")).not.toBeNull();
  });

  it("serves the SPA shell through the worker with security headers", async () => {
    const response = await fetch(new URL("/", baseUrl));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/html/u);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    const html = await response.text();
    expect(html).toContain('id="app"');
    expect(html).toMatch(/EdgeMatte/u);
    expect(html).toMatch(/assets\/index-.*\.js/u);
  });
});
