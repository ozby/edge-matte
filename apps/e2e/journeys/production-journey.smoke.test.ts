import { describe, expect, it } from "vitest";
import { readSamplePng } from "#fixtures";
import { getProductionBaseUrl, shouldRunProductionSmoke } from "../src/journeys/env";

// Real end-to-end journey against live production (no mock pipeline). This is the
// only layer that proves background removal + horizontal flip actually transform
// the image — mock mode is a byte pass-through and cannot. Gated so it only runs
// post-deploy or when explicitly requested (E2E_RUN_PRODUCTION=1 / CI=true).
const describeProduction = shouldRunProductionSmoke() ? describe : describe.skip;

const baseUrl = getProductionBaseUrl();
const SAMPLE_PNG = readSamplePng();

describeProduction("production journey — real transform", () => {
  it("uploads, transforms, serves, and deletes through live cf.image", async () => {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(SAMPLE_PNG)], "journey.png", { type: "image/png" }));

    const createResponse = await fetch(new URL("/api/jobs", baseUrl), {
      method: "POST",
      body: form,
    });
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      id: string;
      status: string;
      imageUrl: string;
      deleteToken: string;
    };
    expect(created.status).toBe("ready");

    const imageResponse = await fetch(new URL(`/i/${created.id}`, baseUrl));
    expect(imageResponse.status).toBe(200);
    expect(imageResponse.headers.get("content-type")).toMatch(/image\//u);
    const served = new Uint8Array(await imageResponse.arrayBuffer());
    // Valid PNG.
    expect(Array.from(served.slice(0, 4))).toStrictEqual([0x89, 0x50, 0x4e, 0x47]);
    // Real pipeline re-encodes (background removal + flip) — output must differ
    // from the uploaded source bytes.
    const input = new Uint8Array(SAMPLE_PNG);
    const identical = served.length === input.length && served.every((b, i) => b === input[i]);
    expect(identical).toBe(false);

    const deleteResponse = await fetch(new URL(`/api/jobs/${created.id}`, baseUrl), {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deleteToken: created.deleteToken }),
    });
    expect(deleteResponse.status).toBe(204);

    expect((await fetch(new URL(`/i/${created.id}`, baseUrl))).status).toBe(404);
  });
});
