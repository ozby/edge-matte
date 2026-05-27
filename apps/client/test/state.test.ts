import { describe, expect, it } from 'vitest'
import {
  canSelectFile,
  canSubmitUpload,
  initialUiState,
  showDeleteConfirmation,
} from '../src/state'

describe('ui state guards', () => {
  it('starts idle and only allows upload from preview or recoverable error', () => {
    expect(initialUiState()).toEqual({ phase: 'idle' })
    expect(canSubmitUpload({ phase: 'idle' })).toBe(false)
    expect(
      canSubmitUpload({
        phase: 'preview',
        previewUrl: 'blob:preview',
        fileName: 'a.png',
        fileSize: 10,
      }),
    ).toBe(true)
    expect(canSubmitUpload({ phase: 'error', message: 'nope', recoverable: true })).toBe(true)
  })

  it('blocks file selection while uploading or processing', () => {
    expect(canSelectFile({ phase: 'uploading', previewUrl: 'blob:x', fileName: 'a.png' })).toBe(
      false,
    )
    expect(
      canSelectFile({
        phase: 'processing',
        previewUrl: 'blob:x',
        jobId: 'job_1',
        status: 'flipping',
      }),
    ).toBe(false)
    expect(canSelectFile({ phase: 'deleted' })).toBe(true)
  })

  it('shows delete confirmation only in confirm-delete phase', () => {
    expect(showDeleteConfirmation({ phase: 'ready', previewUrl: 'blob:x', job: {
      id: 'job_1',
      status: 'ready',
      imageUrl: 'https://edge-matte.ozby.dev/i/job_1',
      pollUrl: 'https://edge-matte.ozby.dev/api/jobs/job_1',
      errorCode: null,
      createdAt: '2026-05-27T00:00:00.000Z',
      updatedAt: '2026-05-27T00:00:00.000Z',
    }, deleteToken: 'token' })).toBe(false)
    expect(
      showDeleteConfirmation({
        phase: 'confirm-delete',
        previewUrl: 'blob:x',
        job: {
          id: 'job_1',
          status: 'ready',
          imageUrl: 'https://edge-matte.ozby.dev/i/job_1',
          pollUrl: 'https://edge-matte.ozby.dev/api/jobs/job_1',
          errorCode: null,
          createdAt: '2026-05-27T00:00:00.000Z',
          updatedAt: '2026-05-27T00:00:00.000Z',
        },
        deleteToken: 'token',
      }),
    ).toBe(true)
  })
})
