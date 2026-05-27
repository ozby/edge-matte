import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudflareImagesTransformer } from "../src/adapters/cloudflare/images-transformer";
import { PhotoroomProvider } from "../src/adapters/photoroom/photoroom-provider";

const PNG_BYTES = Uint8Array.of(0x89, 0x50, 0x4e, 0x47);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("worker adapter semantics", () => {
  it("fails loudly when the Photoroom API key is missing", async () => {
    const provider = new PhotoroomProvider();

    await expect(
      provider.removeBackground(new Blob([PNG_BYTES], { type: "image/png" })),
    ).rejects.toMatchObject({
      code: "background_provider_failed",
      status: 502,
    });
  });

  it("passes the deadline signal through to the provider fetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(new Blob([PNG_BYTES], { type: "image/png" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new PhotoroomProvider("test-key");
    const controller = new AbortController();

    await provider.removeBackground(
      new Blob([PNG_BYTES], { type: "image/png" }),
      controller.signal,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sdk.photoroom.com/v1/segment",
      expect.objectContaining({
        method: "POST",
        headers: { "x-api-key": "test-key" },
        signal: controller.signal,
      }),
    );
  });

  it("fails loudly when the Cloudflare Images binding is missing", async () => {
    const transformer = new CloudflareImagesTransformer(null);

    await expect(
      transformer.flipHorizontal(new Blob([PNG_BYTES], { type: "image/png" }), "image/png"),
    ).rejects.toMatchObject({
      code: "image_transform_failed",
      status: 502,
    });
  });
});
