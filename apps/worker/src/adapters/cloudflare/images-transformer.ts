import { AppError } from "../../core/errors";
import type { ImageTransformer } from "../../ports";

interface ImagesBinding {
  input(stream: ReadableStream): {
    transform(options: { flip: "h" }): {
      output(options: { format: "image/png" }): {
        response(): Promise<Response>;
      };
    };
  };
}

export class CloudflareImagesTransformer implements ImageTransformer {
  constructor(private readonly images: ImagesBinding | null) {}

  async flipHorizontal(input: Blob, _outputType: string): Promise<Response> {
    if (!this.images) {
      throw new AppError(502, "image_transform_failed", "missing IMAGES binding");
    }
    return this.images
      .input(input.stream())
      .transform({ flip: "h" })
      .output({ format: "image/png" })
      .response();
  }
}
