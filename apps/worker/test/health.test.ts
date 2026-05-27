import { env, SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('worker health', () => {
  it('returns ok from /health', async () => {
    const response = await SELF.fetch('http://example.com/health')
    expect(response.status).toBe(200)
    const body = (await response.json()) as { status: string }
    expect(body.status).toBe('ok')
  })

  it('exposes ASSETS and IMAGES_BUCKET bindings in the test env', () => {
    expect(env.ASSETS).toBeDefined()
    expect(env.IMAGES_BUCKET).toBeDefined()
  })
})
