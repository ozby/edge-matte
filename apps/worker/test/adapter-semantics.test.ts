import { describe, expect, it } from "vitest";
import { CloudflareImagesBackgroundRemovalProvider } from "#adapters/cloudflare/images-background-removal-provider";
import { CloudflareImagesTransformer } from "#adapters/cloudflare/images-transformer";

const PNG_BYTES = Uint8Array.of(0x89, 0x50, 0x4e, 0x47);

describe("worker adapter semantics", () => {
  it("fails loudly when the IMAGES binding is missing (background removal)", async () => {
    const provider = new CloudflareImagesBackgroundRemovalProvider(null);

    await expect(
      provider.removeBackground(new Blob([PNG_BYTES], { type: "image/png" })),
    ).rejects.toMatchObject({
      code: "background_provider_failed",
      status: 502,
    });
  });

  it("returns a Blob when the IMAGES binding responds OK", async () => {
    const blob = new Blob([PNG_BYTES], { type: "image/png" });
    const binding = {
      input: () => ({
        transform: () => ({
          output: () => ({
            response: async () => new Response(blob, { status: 200 }),
          }),
        }),
      }),
    };

    const provider = new CloudflareImagesBackgroundRemovalProvider(binding as never);
    const result = await provider.removeBackground(new Blob([PNG_BYTES], { type: "image/png" }));

    expect(result).toBeInstanceOf(Blob);
  });

  it("fails loudly when the IMAGES binding returns a non-OK response (background removal)", async () => {
    const binding = {
      input: () => ({
        transform: () => ({
          output: () => ({
            response: async () => new Response(null, { status: 500 }),
          }),
        }),
      }),
    };

    const provider = new CloudflareImagesBackgroundRemovalProvider(binding as never);

    await expect(
      provider.removeBackground(new Blob([PNG_BYTES], { type: "image/png" })),
    ).rejects.toMatchObject({
      code: "background_provider_failed",
      status: 502,
    });
  });

  it("fails loudly when the IMAGES binding is missing (flip transform)", async () => {
    const transformer = new CloudflareImagesTransformer(null);

    await expect(
      transformer.flipHorizontal(new Blob([PNG_BYTES], { type: "image/png" }), "image/png"),
    ).rejects.toMatchObject({
      code: "image_transform_failed",
      status: 502,
    });
  });
});
