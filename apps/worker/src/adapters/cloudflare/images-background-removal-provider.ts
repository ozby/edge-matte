import { AppError } from "#core/errors";
import type { BackgroundRemovalProvider } from "#ports";

interface ImagesBinding {
  input(stream: ReadableStream): {
    transform(options: { segment: "foreground" }): {
      output(options: { format: "image/png" | "image/webp" }): {
        response(): Promise<Response>;
      };
    };
  };
}

export class CloudflareImagesBackgroundRemovalProvider implements BackgroundRemovalProvider {
  constructor(private readonly images: ImagesBinding | null) {}

  async removeBackground(input: Blob, _signal?: AbortSignal): Promise<Blob> {
    if (!this.images) {
      throw new AppError(502, "background_provider_failed", "missing IMAGES binding");
    }
    try {
      const response = await this.images
        .input(input.stream())
        .transform({ segment: "foreground" })
        .output({ format: "image/png" })
        .response();
      if (!response.ok) {
        throw new AppError(502, "background_provider_failed");
      }
      return response.blob();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, "background_provider_failed");
    }
  }
}
