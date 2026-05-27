import { describe, expect, it } from 'vitest'
import {
  errorCodeToMessage,
  formatFileSize,
  isTerminalStatus,
  statusLabel,
  validateSelectedFile,
} from '../src/format'

describe('format helpers', () => {
  it('formats file sizes for UI copy', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('rejects unsupported or oversized files before upload', () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', {
      type: 'image/png',
    })
    expect(validateSelectedFile(big)).toMatch(/10\.0 MB/u)

    const bad = new File([Uint8Array.of(0x00)], 'bad.bin', { type: 'application/octet-stream' })
    expect(validateSelectedFile(bad)).toMatch(/PNG, JPEG, or WebP/u)
  })

  it('maps API error codes to actionable messages', () => {
    expect(errorCodeToMessage('file_too_large')).toMatch(/too large/u)
    expect(errorCodeToMessage('image_not_found')).toMatch(/no longer exists/u)
  })

  it('labels processing states for progress UI', () => {
    expect(statusLabel('removing_background')).toMatch(/background/u)
    expect(isTerminalStatus('ready')).toBe(true)
    expect(isTerminalStatus('uploading')).toBe(false)
  })
})
