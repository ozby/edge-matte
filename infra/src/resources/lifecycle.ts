import * as cloudflare from '@pulumi/cloudflare'
import { artifactMaxAgeSeconds, cloudflareAccountId } from '../config.js'
import { imagesBucket } from './storage.js'

/**
 * Safety-net cleanup for orphaned job metadata and image blobs when the
 * capability delete path was never invoked (failed/intermediate jobs).
 */
export const imagesBucketLifecycle = new cloudflare.R2BucketLifecycle(
  'edge-matte-images-lifecycle',
  {
    accountId: cloudflareAccountId,
    bucketName: imagesBucket.name,
    rules: [
      {
        id: 'expire-stale-job-metadata',
        enabled: true,
        conditions: { prefix: 'jobs/' },
        deleteObjectsTransition: {
          condition: { type: 'Age', maxAge: artifactMaxAgeSeconds },
        },
      },
      {
        id: 'expire-stale-image-objects',
        enabled: true,
        conditions: { prefix: 'images/' },
        deleteObjectsTransition: {
          condition: { type: 'Age', maxAge: artifactMaxAgeSeconds },
        },
      },
    ],
  },
)
