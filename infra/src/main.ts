/**
 * Pulumi entry — durable Cloudflare resources only.
 *
 * Worker routes, bindings, and deploy are owned by Wrangler (`wrangler.toml`).
 */
import './resources/storage.js'
import './resources/lifecycle.js'

export { R2_BUCKET_NAME } from './config.js'
export { imagesBucket, imagesBucketName } from './resources/storage.js'
export { imagesBucketLifecycle } from './resources/lifecycle.js'
