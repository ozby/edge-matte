import { describe, expect, it } from "vitest";
import { getE2EBaseUrlOrThrow } from "../src/journeys/env";

const baseUrl = getE2EBaseUrlOrThrow("apps/e2e/journeys/upload-delete.contract.test.ts");

const PNG_BYTES = Uint8Array.of(
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0x00,
  0x00,
  0x00,
  0x0d,
  0x49,
  0x48,
  0x44,
  0x52,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01,
  0x08,
  0x06,
  0x00,
  0x00,
  0x00,
  0x1f,
  0x15,
  0xc4,
  0x89,
  0x00,
  0x00,
  0x00,
  0x0a,
  0x49,
  0x44,
  0x41,
  0x54,
  0x78,
  0x9c,
  0x63,
  0x00,
  0x01,
  0x00,
  0x00,
  0x05,
  0x00,
  0x01,
  0x0d,
  0x0a,
  0x2d,
  0xb4,
  0x00,
  0x00,
  0x00,
  0x00,
  0x49,
  0x45,
  0x4e,
  0x44,
  0xae,
  0x42,
  0x60,
  0x82,
);

describe("upload-delete API contract coverage", () => {
  it("uploads one image, serves hosted URL, then deletes to 404", async () => {
    const form = new FormData();
    form.set("file", new File([PNG_BYTES], "contract.png", { type: "image/png" }));

    const createResponse = await fetch(new URL("/api/jobs", baseUrl), {
      method: "POST",
      body: form,
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      id: string;
      status: string;
      imageUrl: string;
      pollUrl: string;
      deleteToken: string;
    };
    expect(created.status).toBe("ready");
    expect(created.imageUrl).toContain(`/i/${created.id}`);

    const statusResponse = await fetch(new URL(`/api/jobs/${created.id}`, baseUrl));
    expect(statusResponse.status).toBe(200);

    const imageResponse = await fetch(new URL(`/i/${created.id}`, baseUrl));
    expect(imageResponse.status).toBe(200);
    expect(imageResponse.headers.get("content-type")).toMatch(/image\//u);

    const deleteResponse = await fetch(new URL(`/api/jobs/${created.id}`, baseUrl), {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deleteToken: created.deleteToken }),
    });
    expect(deleteResponse.status).toBe(204);

    const missingImage = await fetch(new URL(`/i/${created.id}`, baseUrl));
    expect(missingImage.status).toBe(404);

    const missingJob = await fetch(new URL(`/api/jobs/${created.id}`, baseUrl));
    expect(missingJob.status).toBe(404);
  });
});
