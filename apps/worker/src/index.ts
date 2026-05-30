import { createApp } from "./adapters/hono/app";
import { CfImageSegmentProvider } from "./adapters/cloudflare/cf-image-segment-provider";
import { CloudflareImagesTransformer } from "./adapters/cloudflare/images-transformer";
import { MockBackgroundRemovalProvider } from "./adapters/cloudflare/mock-background-removal-provider";
import { MockTransformer } from "./adapters/cloudflare/mock-transformer";
import { R2ImageObjectStore } from "./adapters/cloudflare/r2-image-object-store";
import { R2JobRepository } from "./adapters/cloudflare/r2-job-repository";
import type { ProcessImageJobDeps } from "./core/process-image-job";

type WorkerEnv = Env & {
  IMAGES?: unknown;
  E2E_MOCK_PIPELINE?: string;
};

const createInMemoryDeps = (): ProcessImageJobDeps => {
  const jobs = new Map<string, unknown>();
  const images = new Map<string, Response>();
  return {
    repository: {
      async create(job) {
        jobs.set(job.id, job);
      },
      async update(job) {
        jobs.set(job.id, job);
      },
      async get(id) {
        return (
          (jobs.get(id) as Awaited<ReturnType<ProcessImageJobDeps["repository"]["get"]>>) ?? null
        );
      },
      async delete(id) {
        jobs.delete(id);
      },
    },
    objectStore: {
      async putOriginal() {},
      async putProcessed(job, body, contentType) {
        const blob = body instanceof Blob ? body : await new Response(body).blob();
        images.set(
          job.id,
          new Response(blob.stream(), {
            headers: { "content-type": contentType },
          }),
        );
      },
      async getProcessed(id) {
        return images.get(id) ?? null;
      },
      async deleteAll(job) {
        images.delete(job.id);
      },
    },
    provider: new MockBackgroundRemovalProvider(),
    transformer: new MockTransformer(),
  };
};

export const createWorkerApp = (env?: WorkerEnv) => {
  if (!env) {
    return createApp(createInMemoryDeps());
  }

  const useExplicitMockPipeline = env.E2E_MOCK_PIPELINE === "1";

  return createApp({
    repository: new R2JobRepository(env.IMAGES_BUCKET),
    objectStore: new R2ImageObjectStore(env.IMAGES_BUCKET),
    assets: env.ASSETS,
    provider: useExplicitMockPipeline
      ? new MockBackgroundRemovalProvider()
      : new CfImageSegmentProvider((env.IMAGES ?? null) as never),
    transformer: useExplicitMockPipeline
      ? new MockTransformer()
      : new CloudflareImagesTransformer((env.IMAGES ?? null) as never),
  });
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return createWorkerApp(env).fetch(request);
  },
};
