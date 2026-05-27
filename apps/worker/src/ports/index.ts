import type { ImageJob } from "../core/image-job";

export interface BackgroundRemovalProvider {
  removeBackground(input: Blob, signal?: AbortSignal): Promise<Blob>;
}

export interface ImageTransformer {
  flipHorizontal(input: Blob, outputType: string): Promise<Response>;
}

export interface JobRepository {
  create(job: ImageJob): Promise<void>;
  update(job: ImageJob): Promise<void>;
  get(id: string): Promise<ImageJob | null>;
  delete(id: string): Promise<void>;
}

export interface ImageObjectStore {
  putOriginal(job: ImageJob, file: File): Promise<void>;
  putProcessed(job: ImageJob, body: ReadableStream | Blob, contentType: string): Promise<void>;
  getProcessed(id: string): Promise<Response | null>;
  deleteAll(job: ImageJob): Promise<void>;
}
