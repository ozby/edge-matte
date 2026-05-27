import { describe, expect, it } from 'vitest'
import {
  listE2ESuites,
  normalizeE2EPath,
  resolveE2ESuiteForFile,
  resolveE2ESuiteId,
} from './e2e-suite-manifest'

describe('e2e-suite-manifest', () => {
  it('registers smoke, upload-delete, and production-smoke suites', () => {
    expect(listE2ESuites().map((suite) => suite.id)).toEqual([
      'smoke',
      'upload-delete',
      'production-smoke',
    ])
  })

  it('resolves suite aliases', () => {
    expect(resolveE2ESuiteId('smoke')).toBe('smoke')
    expect(resolveE2ESuiteId('health')).toBe('smoke')
    expect(resolveE2ESuiteId('upload-delete')).toBe('upload-delete')
    expect(resolveE2ESuiteId('contract')).toBe('upload-delete')
    expect(resolveE2ESuiteId('production-smoke')).toBe('production-smoke')
    expect(resolveE2ESuiteId('missing')).toBeNull()
  })

  it('normalizes journey paths from repo root', () => {
    expect(normalizeE2EPath('journeys/smoke.e2e.ts')).toBe(
      'apps/e2e/journeys/smoke.e2e.ts',
    )
  })

  it('maps journey files to suites', () => {
    expect(resolveE2ESuiteForFile('apps/e2e/journeys/upload-delete.e2e.ts')).toEqual({
      normalizedPath: 'apps/e2e/journeys/upload-delete.e2e.ts',
      suiteId: 'upload-delete',
    })
  })
})
