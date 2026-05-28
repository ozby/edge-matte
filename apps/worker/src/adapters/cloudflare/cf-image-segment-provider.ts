import { AppError } from "#core/errors";
import type { BackgroundRemovalProvider } from "#ports";

const randomKey = () => `poc/tmp/${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class CfImageSegmentProvider implements BackgroundRemovalProvider {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly appOrigin: string,
  ) {}

  async removeBackground(input: Blob, _signal?: AbortSignal): Promise<Blob> {
    const key = randomKey();
    try {
      // Store the original temporarily so the CDN path can serve it.
      await this.bucket.put(key, await input.arrayBuffer(), {
        httpMetadata: { contentType: input.type || "image/jpeg" },
      });

      // Sub-request to the Worker's own serving route triggers Cloudflare's
      // CDN image transform pipeline (cf.image), which is distinct from the
      // Workers Images binding and produces solid-mask background removal.
      const response = await fetch(`${this.appOrigin}/poc/raw/${encodeURIComponent(key)}`, {
        cf: {
          image: { segment: "foreground" },
        } as RequestInitCfProperties,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new AppError(
          502,
          "background_provider_failed",
          `cf.image segment failed: ${response.status} ${body}`,
        );
      }

      return response.blob();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, "background_provider_failed", String(error));
    } finally {
      await this.bucket?.delete(key).catch(() => undefined);
    }
  }
}
