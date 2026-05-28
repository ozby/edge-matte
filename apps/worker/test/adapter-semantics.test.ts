import { describe, expect, it } from "vitest";
import { CfImageSegmentProvider } from "#adapters/cloudflare/cf-image-segment-provider";
import { CloudflareImagesTransformer } from "#adapters/cloudflare/images-transformer";

const PNG_BYTES = Uint8Array.of(0x89, 0x50, 0x4e, 0x47);

describe("worker adapter semantics", () => {
  it("fails loudly when the R2 bucket is missing (cf.image segment provider)", async () => {
    const provider = new CfImageSegmentProvider(null as never, "https://example.com");

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
