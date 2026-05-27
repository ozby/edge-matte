import { describe, expect, it } from 'vitest'
import { createWorkerApp } from '../src/index'

const PNG_BYTES = Uint8Array.of(
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
)

describe('worker routes', () => {
  it('handles create, status, image, and delete routes', async () => {
    const app = createWorkerApp()

    const form = new FormData()
    form.set('file', new File([PNG_BYTES], 'sample.png', { type: 'image/png' }))

    const createResponse = await app.fetch(
      new Request('https://edge-matte.ozby.dev/api/jobs', {
        method: 'POST',
        body: form,
      }),
    )
    expect(createResponse.status).toBe(201)
    const created = (await createResponse.json()) as {
      id: string
      status: string
      imageUrl: string
      pollUrl: string
      deleteToken: string
    }
    expect(created.status).toBe('ready')
    expect(created.imageUrl).toContain('/i/')
    expect(created.pollUrl).toContain('/api/jobs/')

    const statusResponse = await app.fetch(
      new Request(`https://edge-matte.ozby.dev/api/jobs/${created.id}`),
    )
    expect(statusResponse.status).toBe(200)
    expect((await statusResponse.json()) as { id: string }).toMatchObject({ id: created.id })

    const imageResponse = await app.fetch(
      new Request(`https://edge-matte.ozby.dev/i/${created.id}`),
    )
    expect(imageResponse.status).toBe(200)
    expect(imageResponse.headers.get('content-type')).toContain('image/')

    const deleteResponse = await app.fetch(
      new Request(`https://edge-matte.ozby.dev/api/jobs/${created.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ deleteToken: created.deleteToken }),
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(deleteResponse.status).toBe(204)

    const missingResponse = await app.fetch(
      new Request(`https://edge-matte.ozby.dev/api/jobs/${created.id}`),
    )
    expect(missingResponse.status).toBe(404)
  })

  it('returns contract errors for invalid upload and delete token', async () => {
    const app = createWorkerApp()

    const oversized = new Uint8Array(10 * 1024 * 1024 + 1)
    const form = new FormData()
    form.set('file', new File([oversized], 'big.png', { type: 'image/png' }))
    const tooLarge = await app.fetch(
      new Request('https://edge-matte.ozby.dev/api/jobs', { method: 'POST', body: form }),
    )
    expect(tooLarge.status).toBe(413)
    expect(await tooLarge.json()).toEqual({ error: { code: 'file_too_large' } })

    const badForm = new FormData()
    badForm.set('file', new File([Uint8Array.of(0x00, 0x11)], 'bad.bin', { type: 'image/png' }))
    const badMedia = await app.fetch(
      new Request('https://edge-matte.ozby.dev/api/jobs', { method: 'POST', body: badForm }),
    )
    expect(badMedia.status).toBe(415)
    expect(await badMedia.json()).toEqual({ error: { code: 'unsupported_media_type' } })
  })
})
