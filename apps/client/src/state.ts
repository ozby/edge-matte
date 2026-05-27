import type { PublicImageJob } from './types'

export type UiPhase =
  | { phase: 'idle' }
  | { phase: 'preview'; previewUrl: string; fileName: string; fileSize: number }
  | { phase: 'uploading'; previewUrl: string; fileName: string }
  | { phase: 'processing'; previewUrl: string; jobId: string; status: string }
  | {
      phase: 'ready'
      previewUrl: string
      job: PublicImageJob
      deleteToken: string
    }
  | {
      phase: 'confirm-delete'
      previewUrl: string
      job: PublicImageJob
      deleteToken: string
    }
  | { phase: 'deleted' }
  | { phase: 'error'; message: string; recoverable: boolean }

export const initialUiState = (): UiPhase => ({ phase: 'idle' })

export const canSubmitUpload = (state: UiPhase): boolean =>
  state.phase === 'preview' || state.phase === 'error'

export const canSelectFile = (state: UiPhase): boolean =>
  state.phase === 'idle' ||
  state.phase === 'preview' ||
  state.phase === 'ready' ||
  state.phase === 'deleted' ||
  state.phase === 'error'

export const showDeleteConfirmation = (state: UiPhase): boolean => state.phase === 'confirm-delete'
