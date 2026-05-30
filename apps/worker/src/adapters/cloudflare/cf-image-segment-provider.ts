import { AppError } from "#core/errors";
import { cleanPngMatteEdges } from "./png-matte-edge-cleaner";
import type { ImagesBinding } from "./images-binding";
import type { BackgroundRemovalProvider } from "#ports";

export class CfImageSegmentProvider implements BackgroundRemovalProvider {
  constructor(private readonly images: ImagesBinding | null) {}

  async removeBackground(input: Blob, _signal?: AbortSignal): Promise<Blob> {
    try {
      if (!this.images) {
        throw new AppError(502, "background_provider_failed", "missing IMAGES binding");
      }
      const response = await (
        await this.images
          .input(input.stream())
          .transform({ segment: "foreground" })
          .output({ format: "image/png" })
      ).response();

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new AppError(
          502,
          "background_provider_failed",
          `images segment failed: ${response.status} ${body}`,
        );
      }

      return await cleanPngMatteEdges(await response.blob());
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, "background_provider_failed", String(error));
    }
  }
}
