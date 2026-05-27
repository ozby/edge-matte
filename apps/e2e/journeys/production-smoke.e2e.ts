import { describe, expect, it } from 'vitest'
import { getProductionBaseUrl, shouldRunProductionSmoke } from '../src/journeys/env'

const describeProduction = shouldRunProductionSmoke() ? describe : describe.skip

describeProduction('production-smoke journey', () => {
  const baseUrl = getProductionBaseUrl()

  it('returns ok from production /health', async () => {
    const response = await fetch(new URL('/health', baseUrl))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' })
  })

  it('serves the production SPA shell', async () => {
    const response = await fetch(new URL('/', baseUrl))
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toMatch(/EdgeMatte/u)
    expect(html).toMatch(/id="app"|Upload one image/u)
  })
})
