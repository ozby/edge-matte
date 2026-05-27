import { AppError, fileTooLargeError, unsupportedMediaTypeError } from './errors'
import { createImageJob, type ImageJob } from './image-job'
import type {
  BackgroundRemovalProvider,
  ImageObjectStore,
  ImageTransformer,
  JobRepository,
} from '../ports'

export interface ProcessImageJobCommand {
  file: File
  appOrigin: string
}

export interface ProcessImageJobDeps {
  repository: JobRepository
  objectStore: ImageObjectStore
  provider: BackgroundRemovalProvider
  transformer: ImageTransformer
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const assertSupportedFile = async (file: File): Promise<void> => {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw fileTooLargeError()
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw unsupportedMediaTypeError()
  }
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
  if (!(isPng || isJpeg || isWebp)) {
    throw unsupportedMediaTypeError()
  }
}

const withStatus = (job: ImageJob, status: ImageJob['status'], errorCode: string | null = null): ImageJob => ({
  ...job,
  status,
  errorCode,
  updatedAt: new Date().toISOString(),
})

export const processImageJob = async (
  command: ProcessImageJobCommand,
  deps: ProcessImageJobDeps,
): Promise<ImageJob> => {
  await assertSupportedFile(command.file)
  let job = await createImageJob({ appOrigin: command.appOrigin })
  await deps.repository.create(job)

  try {
    job = withStatus(job, 'uploading')
    await deps.repository.update(job)
    await deps.objectStore.putOriginal(job, command.file)

    job = withStatus(job, 'removing_background')
    await deps.repository.update(job)
    const cutout = await deps.provider.removeBackground(command.file)

    job = withStatus(job, 'flipping')
    await deps.repository.update(job)
    const transformed = await deps.transformer.flipHorizontal(cutout, 'image/png')

    await deps.objectStore.putProcessed(job, transformed.body ?? new Blob(), 'image/png')
    job = withStatus(job, 'ready')
    await deps.repository.update(job)
    return job
  } catch (error) {
    const code =
      error instanceof AppError
        ? error.code
        : job.status === 'flipping'
          ? 'image_transform_failed'
          : job.status === 'removing_background'
            ? 'background_provider_failed'
            : 'storage_failed'
    job = withStatus(job, 'failed', code)
    await deps.repository.update(job)
    throw error
  }
}
