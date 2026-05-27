import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PRODUCTION_DOMAIN,
  PRODUCTION_ORIGIN,
  R2_BUCKET_NAME,
  arrayTableBlocks,
  blockHasAssignment,
  readText,
  sectionLines,
} from './helpers.mjs'

const wrangler = readText('wrangler.toml')

test('wrangler.toml targets the worker entry and static asset directory', () => {
  assert.match(wrangler, /^name\s*=\s*"edge-matte"/mu)
  assert.match(wrangler, /main\s*=\s*"apps\/worker\/src\/index\.ts"/u)
  const assets = sectionLines(wrangler, '[assets]')
  assert.ok(assets, 'missing [assets] table')
  assert.ok(
    assets.some((line) => /directory\s*=\s*"apps\/client\/dist"/u.test(line)),
    'ASSETS must serve the built client bundle',
  )
  assert.ok(
    assets.some((line) => /binding\s*=\s*"ASSETS"/u.test(line)),
    'static assets must bind as ASSETS',
  )
})

test('wrangler.toml declares Cloudflare Images binding for horizontal flip', () => {
  const images = sectionLines(wrangler, '[images]')
  assert.ok(images, 'missing [images] table required by architecture (env.IMAGES)')
  assert.ok(
    images.some((line) => /binding\s*=\s*"IMAGES"/u.test(line)),
    'Images binding must be exposed as IMAGES',
  )
})

test('wrangler.toml wires R2 object storage for job metadata and blobs', () => {
  const rootBuckets = arrayTableBlocks(wrangler, '[[r2_buckets]]')
  assert.ok(rootBuckets.length >= 1, 'expected at least one [[r2_buckets]] block')
  assert.ok(
    rootBuckets.some(
      (block) =>
        blockHasAssignment(block, 'binding', 'IMAGES_BUCKET') &&
        blockHasAssignment(block, 'bucket_name', R2_BUCKET_NAME),
    ),
    'root R2 binding must be IMAGES_BUCKET -> edge-matte-images',
  )

  const productionBuckets = arrayTableBlocks(wrangler, '[[env.production.r2_buckets]]')
  assert.ok(productionBuckets.length >= 1, 'expected production [[env.production.r2_buckets]]')
  assert.ok(
    productionBuckets.some(
      (block) =>
        blockHasAssignment(block, 'binding', 'IMAGES_BUCKET') &&
        blockHasAssignment(block, 'bucket_name', R2_BUCKET_NAME),
    ),
    'production R2 binding must match the Pulumi-owned bucket name',
  )
})

test('wrangler.toml routes production traffic to edge-matte.ozby.dev', () => {
  const production = sectionLines(wrangler, '[env.production]')
  assert.ok(production, 'missing [env.production] table')
  assert.ok(
    production.some((line) => /workers_dev\s*=\s*false/u.test(line)),
    'production must not rely on workers.dev',
  )

  const routes = arrayTableBlocks(wrangler, '[[env.production.routes]]')
  assert.ok(routes.length >= 1, 'expected [[env.production.routes]]')
  assert.ok(
    routes.some(
      (block) =>
        blockHasAssignment(block, 'pattern', PRODUCTION_DOMAIN) &&
        blockHasAssignment(block, 'custom_domain', /true/u),
    ),
    `production route must be ${PRODUCTION_DOMAIN} with custom_domain=true`,
  )
})

test('wrangler.toml keeps APP_ORIGIN aligned with the public production URL', () => {
  const productionVars = sectionLines(wrangler, '[env.production.vars]')
  assert.ok(productionVars, 'missing [env.production.vars]')
  assert.ok(
    productionVars.some((line) => new RegExp(`APP_ORIGIN\\s*=\\s*"${PRODUCTION_ORIGIN}"`, 'u').test(line)),
    `APP_ORIGIN must be ${PRODUCTION_ORIGIN}`,
  )
})
