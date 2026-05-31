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
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_ACTION?: string;
  TURNSTILE_EXPECTED_HOSTNAME?: string;
  TURNSTILE_VERIFY_URL?: string;
  TURNSTILE_VERIFY_TIMEOUT_MS?: string;
};

const DEFAULT_TURNSTILE_ACTION = "upload";

const toOptionalString = (value: string | undefined): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const toOptionalNumber = (value: string | undefined): number | null => {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toSecurityConfig = (env: WorkerEnv) => {
  const siteKey = toOptionalString(env.TURNSTILE_SITE_KEY);
  const secretKey = toOptionalString(env.TURNSTILE_SECRET_KEY);
  const action = toOptionalString(env.TURNSTILE_ACTION) ?? DEFAULT_TURNSTILE_ACTION;
  const expectedHostname =
    toOptionalString(env.TURNSTILE_EXPECTED_HOSTNAME) ?? new URL(env.APP_ORIGIN).hostname;
  const verifyUrl = toOptionalString(env.TURNSTILE_VERIFY_URL);
  const timeoutMs = toOptionalNumber(env.TURNSTILE_VERIFY_TIMEOUT_MS);

  if (
    siteKey == null &&
    secretKey == null &&
    verifyUrl == null &&
    timeoutMs == null &&
    env.TURNSTILE_ACTION == null &&
    env.TURNSTILE_EXPECTED_HOSTNAME == null
  ) {
    return undefined;
  }

  return {
    turnstile: {
      siteKey,
      secretKey,
      action,
      expectedHostname,
      verifyUrl,
      timeoutMs,
    },
  };
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
    securityConfig: toSecurityConfig(env),
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
