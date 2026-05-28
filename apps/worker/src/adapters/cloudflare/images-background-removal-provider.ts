import { AppError } from "#core/errors";
import type { BackgroundRemovalProvider } from "#ports";

interface ImagesBindingResult {
  response(): Promise<Response>;
}

interface ImagesBinding {
  input(stream: ReadableStream): {
    transform(options: { segment: "foreground" }): {
      output(options: { format: "image/png" | "image/webp" }): Promise<ImagesBindingResult>;
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
      const result = await this.images
        .input(input.stream())
        .transform({ segment: "foreground" })
        .output({ format: "image/png" });
      const response = await result.response();
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new AppError(
          502,
          "background_provider_failed",
          `status=${response.status} body=${body}`,
        );
      }
      return response.blob();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, "background_provider_failed", String(error));
    }
  }
}
