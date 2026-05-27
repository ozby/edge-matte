import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = resolve(import.meta.dirname, '..')

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'))
}

function readText(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

test('root package.json routes quality scripts through vp', () => {
  const pkg = readJson('package.json')
  for (const script of ['build', 'lint', 'check-types']) {
    assert.match(pkg.scripts[script], /^vp run -r /u, `${script} must delegate to vp recursively`)
  }
  assert.match(pkg.scripts.test, /vp run -r test/u, 'test must include vp run -r test')
  assert.match(pkg.scripts.test, /node --test/u, 'test must run root governance tests')
})

test('required workspace config files exist', () => {
  for (const file of [
    'pnpm-workspace.yaml',
    'tsconfig.json',
    'wrangler.toml',
    'agent-kit.config.ts',
    'apps/worker/package.json',
    'apps/client/package.json',
    'apps/e2e/package.json',
  ]) {
    assert.ok(existsSync(resolve(root, file)), `missing ${file}`)
  }
})

test('wrangler.toml declares ASSETS binding and production route', () => {
  const wrangler = readText('wrangler.toml')
  assert.match(wrangler, /binding\s*=\s*"ASSETS"/u)
  assert.match(wrangler, /edge-matte\.ozby\.dev/u)
  assert.match(wrangler, /custom_domain\s*=\s*true/u)
})

test('agent-kit.config.ts wires the e2e host adapter', () => {
  const config = readText('agent-kit.config.ts')
  assert.match(config, /hostAdapterModule/u)
  assert.match(config, /\.\/apps\/e2e\/src\/agent-kit-host-adapter/u)
})

test('apps/e2e exposes smoke suite manifest wiring', () => {
  const manifest = readText('apps/e2e/src/e2e-suite-manifest.ts')
  assert.match(manifest, /id:\s*['"]smoke['"]/u)
  assert.match(manifest, /journeys\/smoke\.e2e\.ts/u)
  assert.ok(existsSync(resolve(root, 'apps/e2e/journeys/smoke.e2e.ts')))
  assert.ok(existsSync(resolve(root, 'apps/e2e/src/agent-kit-host-adapter.ts')))
})

test('secret onboarding docs exist without forbidden local secret files', () => {
  assert.ok(existsSync(resolve(root, 'docs/secrets.md')))
  assert.ok(existsSync(resolve(root, '.env.example')))
  for (const forbidden of ['.dev.vars', '.dev.vars.example', '.env', '.env.local']) {
    assert.equal(existsSync(resolve(root, forbidden)), false, `${forbidden} must not exist`)
  }
})
