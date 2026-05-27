import { describe, expect, it } from "vitest";
import {
  createImageJob,
  toPublicImageJob,
  verifyDeleteToken,
  type ImageJob,
} from "../src/core/image-job";
import { deriveObjectKeys } from "../src/core/object-keys";
import {
  AppError,
  errorResponse,
  fileTooLargeError,
  imageNotFoundError,
  invalidDeleteTokenError,
  unsupportedMediaTypeError,
} from "../src/core/errors";
import { MAX_UPLOAD_BYTES, processImageJob } from "../src/core/process-image-job";
import type {
  BackgroundRemovalProvider,
  ImageObjectStore,
  ImageTransformer,
  JobRepository,
} from "../src/ports";

const PNG_BYTES = Uint8Array.of(
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0x00,
  0x00,
  0x00,
  0x0d,
);

const createPngFile = (size = PNG_BYTES.length): File => {
  const bytes = new Uint8Array(Math.max(size, PNG_BYTES.length));
  bytes.set(PNG_BYTES);
  return new File([bytes], "test.png", { type: "image/png" });
};

class InMemoryJobRepository implements JobRepository {
  private readonly jobs = new Map<string, ImageJob>();

  async create(job: ImageJob) {
    this.jobs.set(job.id, job);
  }

  async update(job: ImageJob) {
    this.jobs.set(job.id, job);
  }

  async get(id: string) {
    return this.jobs.get(id) ?? null;
  }

  async delete(id: string) {
    this.jobs.delete(id);
  }

  list(): ImageJob[] {
    return Array.from(this.jobs.values());
  }
}

class InMemoryObjectStore implements ImageObjectStore {
  private readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  async putOriginal(job: ImageJob, file: File) {
    this.objects.set(job.originalObjectKey, {
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
    });
  }

  async putProcessed(job: ImageJob, body: ReadableStream | Blob, contentType: string) {
    const blob = body instanceof Blob ? body : await new Response(body).blob();
    this.objects.set(job.processedObjectKey, {
      body: new Uint8Array(await blob.arrayBuffer()),
      contentType,
    });
  }

  async getProcessed(id: string) {
    const object = this.objects.get(`images/${id}/processed`);
    if (!object) {
      return null;
    }
    return new Response(object.body, {
      headers: { "content-type": object.contentType },
    });
  }

  async deleteAll(job: ImageJob) {
    this.objects.delete(job.originalObjectKey);
    this.objects.delete(job.processedObjectKey);
  }

  storedKeys(): string[] {
    return Array.from(this.objects.keys()).sort();
  }
}

describe("core pipeline", () => {
  it("derives object keys and redacts private fields", async () => {
    const id = "job_1234";
    expect(deriveObjectKeys(id)).toEqual({
      metadata: "jobs/job_1234.json",
      original: "images/job_1234/original",
      processed: "images/job_1234/processed",
    });

    const job = await createImageJob({ id, appOrigin: "https://edge-matte.ozby.dev" });
    expect(await verifyDeleteToken(job.deleteTokenHash, job.deleteToken)).toBe(true);
    expect(toPublicImageJob(job)).toMatchObject({
      id,
      status: "validating",
      pollUrl: "https://edge-matte.ozby.dev/api/jobs/job_1234",
      imageUrl: "https://edge-matte.ozby.dev/i/job_1234",
    });
  });

  it("maps errors to API-safe payloads", () => {
    const response = errorResponse(fileTooLargeError());
    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: { code: "file_too_large" } });
    expect(errorResponse(new AppError(500, "image_transform_failed")).body).toEqual({
      error: { code: "image_transform_failed" },
    });
    expect(errorResponse(imageNotFoundError()).status).toBe(404);
    expect(errorResponse(invalidDeleteTokenError()).status).toBe(401);
    expect(errorResponse(unsupportedMediaTypeError()).status).toBe(415);
  });

  it("enforces the 8 MiB upload contract", () => {
    expect(MAX_UPLOAD_BYTES).toBe(8 * 1024 * 1024);
  });

  it("executes upload -> background removal -> flip -> ready", async () => {
    const transitions: string[] = [];
    const repository = new InMemoryJobRepository();
    const objectStore = new InMemoryObjectStore();

    const provider: BackgroundRemovalProvider = {
      async removeBackground(input) {
        expect(input.type).toBe("image/png");
        transitions.push("removing_background");
        return new Blob([await input.arrayBuffer()], { type: "image/png" });
      },
    };

    const transformer: ImageTransformer = {
      async flipHorizontal(input, outputType) {
        transitions.push("flipping");
        expect(outputType).toBe("image/png");
        return new Response(input.stream(), {
          headers: { "content-type": "image/png" },
        });
      },
    };

    const result = await processImageJob(
      { file: createPngFile(), appOrigin: "https://edge-matte.ozby.dev" },
      { repository, objectStore, provider, transformer },
    );

    expect(transitions).toEqual(["removing_background", "flipping"]);
    expect(result.status).toBe("ready");
    expect(result.errorCode).toBeNull();
    expect(objectStore.storedKeys()).toEqual([result.originalObjectKey, result.processedObjectKey]);
  });

  it("fails loudly on provider deadline, cleans blobs, and preserves failed job metadata", async () => {
    const repository = new InMemoryJobRepository();
    const objectStore = new InMemoryObjectStore();

    const provider: BackgroundRemovalProvider = {
      async removeBackground(_input, signal) {
        return await new Promise<Blob>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
    };

    const transformer: ImageTransformer = {
      async flipHorizontal() {
        throw new Error("transform should not run after provider timeout");
      },
    };

    await expect(
      processImageJob(
        { file: createPngFile(), appOrigin: "https://edge-matte.ozby.dev" },
        {
          repository,
          objectStore,
          provider,
          transformer,
          backgroundRemovalDeadlineMs: 1,
        },
      ),
    ).rejects.toMatchObject({ code: "background_provider_failed", status: 502 });

    const [job] = repository.list();
    expect(job).toMatchObject({
      status: "failed",
      errorCode: "background_provider_failed",
    });
    expect(await repository.get(job.id)).toMatchObject({ id: job.id, status: "failed" });
    expect(objectStore.storedKeys()).toEqual([]);
  });

  it("cleans orphaned blobs but keeps failed metadata when transform fails", async () => {
    const repository = new InMemoryJobRepository();
    const objectStore = new InMemoryObjectStore();

    const provider: BackgroundRemovalProvider = {
      async removeBackground(input) {
        return new Blob([await input.arrayBuffer()], { type: "image/png" });
      },
    };

    const transformer: ImageTransformer = {
      async flipHorizontal() {
        throw new Error("transform exploded");
      },
    };

    await expect(
      processImageJob(
        { file: createPngFile(), appOrigin: "https://edge-matte.ozby.dev" },
        { repository, objectStore, provider, transformer },
      ),
    ).rejects.toThrow("transform exploded");

    const [job] = repository.list();
    expect(job).toMatchObject({
      status: "failed",
      errorCode: "image_transform_failed",
    });
    expect(await repository.get(job.id)).toMatchObject({ id: job.id, status: "failed" });
    expect(await objectStore.getProcessed(job.id)).toBeNull();
    expect(objectStore.storedKeys()).toEqual([]);
  });

  it("rejects oversized uploads before any storage side effects", async () => {
    const repository = new InMemoryJobRepository();
    const objectStore = new InMemoryObjectStore();

    const provider: BackgroundRemovalProvider = {
      async removeBackground(input) {
        return input;
      },
    };

    const transformer: ImageTransformer = {
      async flipHorizontal(input) {
        return new Response(input.stream());
      },
    };

    await expect(
      processImageJob(
        {
          file: createPngFile(MAX_UPLOAD_BYTES + 1),
          appOrigin: "https://edge-matte.ozby.dev",
        },
        { repository, objectStore, provider, transformer },
      ),
    ).rejects.toMatchObject({ code: "file_too_large" });

    expect(repository.list()).toEqual([]);
    expect(objectStore.storedKeys()).toEqual([]);
  });
});
