import type { ImageJob } from '../../core/image-job'
import { deriveObjectKeys } from '../../core/object-keys'
import type { ImageObjectStore } from '../../ports'

export class R2ImageObjectStore implements ImageObjectStore {
  constructor(private readonly bucket: R2Bucket) {}

  async putOriginal(job: ImageJob, file: File): Promise<void> {
    await this.bucket.put(job.originalObjectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    })
  }

  async putProcessed(job: ImageJob, body: ReadableStream | Blob, contentType: string): Promise<void> {
    const blob = body instanceof Blob ? body : await new Response(body).blob()
    await this.bucket.put(job.processedObjectKey, await blob.arrayBuffer(), {
      httpMetadata: { contentType },
    })
  }

  async getProcessed(id: string): Promise<Response | null> {
    const object = await this.bucket.get(deriveObjectKeys(id).processed)
    if (!object) {
      return null
    }
    return new Response(object.body, {
      headers: { 'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream' },
    })
  }

  async deleteAll(job: ImageJob): Promise<void> {
    await this.bucket.delete(job.originalObjectKey)
    await this.bucket.delete(job.processedObjectKey)
  }
}
