import { describe, expect, it } from 'vitest'
import {
  createImageJob,
  toPublicImageJob,
  verifyDeleteToken,
} from '../src/core/image-job'
import { deriveObjectKeys } from '../src/core/object-keys'
import {
  AppError,
  errorResponse,
  fileTooLargeError,
  imageNotFoundError,
  invalidDeleteTokenError,
  unsupportedMediaTypeError,
} from '../src/core/errors'
import { processImageJob } from '../src/core/process-image-job'
import type {
  BackgroundRemovalProvider,
  ImageObjectStore,
  ImageTransformer,
  JobRepository,
} from '../src/ports'

class InMemoryJobRepository implements JobRepository {
  private readonly jobs = new Map<string, ReturnType<typeof createImageJob>>()

  async create(job: ReturnType<typeof createImageJob>) {
    this.jobs.set(job.id, job)
  }

  async update(job: ReturnType<typeof createImageJob>) {
    this.jobs.set(job.id, job)
  }

  async get(id: string) {
    return this.jobs.get(id) ?? null
  }

  async delete(id: string) {
    this.jobs.delete(id)
  }
}

class InMemoryObjectStore implements ImageObjectStore {
  private readonly objects = new Map<string, { body: Uint8Array; contentType: string }>()

  async putOriginal(job: ReturnType<typeof createImageJob>, file: File) {
    this.objects.set(job.originalObjectKey, {
      body: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
    })
  }

  async putProcessed(job: ReturnType<typeof createImageJob>, body: ReadableStream | Blob, contentType: string) {
    const blob = body instanceof Blob ? body : await new Response(body).blob()
    this.objects.set(job.processedObjectKey, {
      body: new Uint8Array(await blob.arrayBuffer()),
      contentType,
    })
  }

  async getProcessed(id: string) {
    const object = this.objects.get(`images/${id}/processed`)
    if (!object) {
      return null
    }
    return new Response(object.body, {
      headers: { 'content-type': object.contentType },
    })
  }

  async deleteAll(job: ReturnType<typeof createImageJob>) {
    this.objects.delete(job.originalObjectKey)
    this.objects.delete(job.processedObjectKey)
  }
}

describe('core pipeline', () => {
  it('derives object keys and redacts private fields', async () => {
    const id = 'job_1234'
    expect(deriveObjectKeys(id)).toEqual({
      metadata: 'jobs/job_1234.json',
      original: 'images/job_1234/original',
      processed: 'images/job_1234/processed',
    })

    const job = await createImageJob({ id, appOrigin: 'https://edge-matte.ozby.dev' })
    expect(await verifyDeleteToken(job.deleteTokenHash, job.deleteToken)).toBe(true)
    expect(toPublicImageJob(job)).toMatchObject({
      id,
      status: 'validating',
      pollUrl: 'https://edge-matte.ozby.dev/api/jobs/job_1234',
      imageUrl: 'https://edge-matte.ozby.dev/i/job_1234',
    })
  })

  it('maps errors to API-safe payloads', () => {
    const response = errorResponse(fileTooLargeError())
    expect(response.status).toBe(413)
    expect(response.body).toEqual({ error: { code: 'file_too_large' } })
    expect(errorResponse(new AppError(500, 'image_transform_failed')).body).toEqual({
      error: { code: 'image_transform_failed' },
    })
    expect(errorResponse(imageNotFoundError()).status).toBe(404)
    expect(errorResponse(invalidDeleteTokenError()).status).toBe(401)
    expect(errorResponse(unsupportedMediaTypeError()).status).toBe(415)
  })

  it('executes upload -> background removal -> flip -> ready', async () => {
    const transitions: string[] = []
    const repository = new InMemoryJobRepository()
    const objectStore = new InMemoryObjectStore()

    const provider: BackgroundRemovalProvider = {
      async removeBackground(input) {
        expect(input.type).toBe('image/png')
        transitions.push('removing_background')
        return new Blob([await input.arrayBuffer()], { type: 'image/png' })
      },
    }

    const transformer: ImageTransformer = {
      async flipHorizontal(input, outputType) {
        transitions.push('flipping')
        expect(outputType).toBe('image/png')
        return new Response(input.stream(), {
          headers: { 'content-type': 'image/png' },
        })
      },
    }

    const file = new File([Uint8Array.of(0x89, 0x50, 0x4e, 0x47)], 'test.png', {
      type: 'image/png',
    })

    const result = await processImageJob(
      { file, appOrigin: 'https://edge-matte.ozby.dev' },
      { repository, objectStore, provider, transformer },
    )

    expect(transitions).toEqual(['removing_background', 'flipping'])
    expect(result.status).toBe('ready')
    expect(result.errorCode).toBeNull()
  })
})
