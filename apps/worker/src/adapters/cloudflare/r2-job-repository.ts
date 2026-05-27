import type { ImageJob } from '../../core/image-job'
import { deriveObjectKeys } from '../../core/object-keys'
import type { JobRepository } from '../../ports'

export class R2JobRepository implements JobRepository {
  constructor(private readonly bucket: R2Bucket) {}

  async create(job: ImageJob): Promise<void> {
    await this.bucket.put(deriveObjectKeys(job.id).metadata, JSON.stringify(job), {
      httpMetadata: { contentType: 'application/json' },
    })
  }

  async update(job: ImageJob): Promise<void> {
    await this.create(job)
  }

  async get(id: string): Promise<ImageJob | null> {
    const object = await this.bucket.get(deriveObjectKeys(id).metadata)
    if (!object) {
      return null
    }
    return (await object.json()) as ImageJob
  }

  async delete(id: string): Promise<void> {
    await this.bucket.delete(deriveObjectKeys(id).metadata)
  }
}
