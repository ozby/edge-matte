import { AppError } from "#core/errors";
import { SEGMENT_TMP_PREFIX } from "#core/object-keys";
import type { BackgroundRemovalProvider } from "#ports";

const randomKey = () => `${SEGMENT_TMP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class CfImageSegmentProvider implements BackgroundRemovalProvider {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly appOrigin: string,
  ) {}

  async removeBackground(input: Blob, signal?: AbortSignal): Promise<Blob> {
    const key = randomKey();
    try {
      // Store the original temporarily so the CDN path can serve it.
      await this.bucket.put(key, await input.arrayBuffer(), {
        httpMetadata: { contentType: input.type || "image/jpeg" },
      });

      // Sub-request to the Worker's own serving route triggers Cloudflare's
      // CDN image transform pipeline (cf.image), which is distinct from the
      // Workers Images binding and produces solid-mask background removal.
      // Pass `signal` so the upstream call cancels when the caller's deadline trips.
      const response = await fetch(`${this.appOrigin}/internal/raw/${encodeURIComponent(key)}`, {
        signal,
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

      return await response.blob();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, "background_provider_failed", String(error));
    } finally {
      // Best-effort cleanup. Skip when the bucket is missing (only reachable in the
      // missing-binding contract test); for real failures, log instead of swallowing.
      if (this.bucket) {
        try {
          await this.bucket.delete(key);
        } catch (cleanupError) {
          console.warn(`${SEGMENT_TMP_PREFIX}cleanup failed`, {
            key,
            error: String(cleanupError),
          });
        }
      }
    }
  }
}
