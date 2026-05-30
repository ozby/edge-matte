import { AppError } from "#core/errors";
import type { ImagesBinding } from "./images-binding";
import type { ImageTransformer } from "#ports";

export class CloudflareImagesTransformer implements ImageTransformer {
  constructor(private readonly images: ImagesBinding | null) {}

  async flipHorizontalAsPng(input: Blob): Promise<Blob> {
    if (!this.images) {
      throw new AppError(502, "image_transform_failed", "missing IMAGES binding");
    }
    const result = await this.images
      .input(input.stream())
      .transform({ flip: "h" })
      .output({ format: "image/png" });
    return (await result.response()).blob();
  }
}
