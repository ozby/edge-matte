import { formatFileSize, statusLabel } from './format'
import type { UiPhase } from './state'

export interface UiElements {
  root: HTMLElement
  fileInput: HTMLInputElement
  pickButton: HTMLButtonElement
  submitButton: HTMLButtonElement
  resetButton: HTMLButtonElement
  statusEl: HTMLElement
  previewEl: HTMLElement
  previewImage: HTMLImageElement
  metaEl: HTMLElement
  resultPanel: HTMLElement
  resultUrl: HTMLAnchorElement
  copyButton: HTMLButtonElement
  downloadButton: HTMLAnchorElement
  deleteButton: HTMLButtonElement
  confirmDeleteButton: HTMLButtonElement
  cancelDeleteButton: HTMLButtonElement
  errorEl: HTMLElement
}

export const createUi = (mount: HTMLElement): UiElements => {
  mount.innerHTML = `
    <main class="edge-matte">
      <header>
        <h1>EdgeMatte</h1>
        <p>Upload one image, remove its background, flip it, and host the result.</p>
      </header>
      <section class="panel" aria-live="polite">
        <div class="actions">
          <input id="file-input" type="file" accept="image/png,image/jpeg,image/webp" hidden />
          <button id="pick-file" type="button">Choose image</button>
          <button id="submit-upload" type="button" disabled>Upload &amp; process</button>
          <button id="reset-flow" type="button" hidden>Start over</button>
        </div>
        <p id="status" class="status">Select a single image to begin.</p>
        <p id="error" class="error" hidden></p>
        <figure id="preview" class="preview" hidden>
          <img id="preview-image" alt="Selected upload preview" />
          <figcaption id="preview-meta"></figcaption>
        </figure>
        <section id="result" class="result" hidden>
          <p>Hosted result</p>
          <a id="result-url" href="#" target="_blank" rel="noopener noreferrer"></a>
          <div class="result-actions">
            <button id="copy-url" type="button">Copy URL</button>
            <a id="download-result" download>Download</a>
            <button id="delete-job" type="button">Delete artifacts</button>
          </div>
          <div id="delete-confirm" class="delete-confirm" hidden>
            <p>Delete the hosted image and all stored artifacts?</p>
            <button id="confirm-delete" type="button">Yes, delete</button>
            <button id="cancel-delete" type="button">Cancel</button>
          </div>
        </section>
      </section>
    </main>
  `

  const query = <T extends HTMLElement>(id: string): T => {
    const el = mount.querySelector(`#${id}`)
    if (!el) throw new Error(`Missing #${id}`)
    return el as T
  }

  return {
    root: mount,
    fileInput: query('file-input'),
    pickButton: query('pick-file'),
    submitButton: query('submit-upload'),
    resetButton: query('reset-flow'),
    statusEl: query('status'),
    previewEl: query('preview'),
    previewImage: query('preview-image'),
    metaEl: query('preview-meta'),
    resultPanel: query('result'),
    resultUrl: query('result-url'),
    copyButton: query('copy-url'),
    downloadButton: query('download-result'),
    deleteButton: query('delete-job'),
    confirmDeleteButton: query('confirm-delete'),
    cancelDeleteButton: query('cancel-delete'),
    errorEl: query('error'),
  }
}

export const renderUi = (ui: UiElements, state: UiPhase): void => {
  ui.errorEl.hidden = true
  ui.errorEl.textContent = ''
  ui.resetButton.hidden = state.phase === 'idle'

  switch (state.phase) {
    case 'idle':
      ui.statusEl.textContent = 'Select a single image to begin.'
      ui.previewEl.hidden = true
      ui.resultPanel.hidden = true
      ui.submitButton.disabled = true
      ui.pickButton.disabled = false
      ui.deleteButton.hidden = false
      ui.confirmDeleteButton.parentElement!.hidden = true
      break
    case 'preview':
      ui.statusEl.textContent = `Ready to upload ${state.fileName} (${formatFileSize(state.fileSize)}).`
      ui.previewEl.hidden = false
      ui.previewImage.src = state.previewUrl
      ui.metaEl.textContent = state.fileName
      ui.resultPanel.hidden = true
      ui.submitButton.disabled = false
      ui.pickButton.disabled = false
      break
    case 'uploading':
      ui.statusEl.textContent = 'Uploading…'
      ui.previewEl.hidden = false
      ui.previewImage.src = state.previewUrl
      ui.metaEl.textContent = state.fileName
      ui.resultPanel.hidden = true
      ui.submitButton.disabled = true
      ui.pickButton.disabled = true
      break
    case 'processing':
      ui.statusEl.textContent = statusLabel(state.status)
      ui.previewEl.hidden = false
      ui.previewImage.src = state.previewUrl
      ui.metaEl.textContent = `Job ${state.jobId}`
      ui.resultPanel.hidden = true
      ui.submitButton.disabled = true
      ui.pickButton.disabled = true
      break
    case 'ready':
      ui.statusEl.textContent = 'Processing complete. Copy or open the hosted URL.'
      ui.previewEl.hidden = false
      ui.previewImage.src = state.previewUrl
      ui.metaEl.textContent = state.job.id
      ui.resultPanel.hidden = false
      ui.resultUrl.href = state.job.imageUrl
      ui.resultUrl.textContent = state.job.imageUrl
      ui.downloadButton.href = state.job.imageUrl
      ui.downloadButton.download = `${state.job.id}.png`
      ui.deleteButton.hidden = false
      ui.confirmDeleteButton.parentElement!.hidden = true
      ui.submitButton.disabled = true
      ui.pickButton.disabled = true
      break
    case 'confirm-delete':
      ui.statusEl.textContent = 'Confirm deletion to remove hosted artifacts.'
      ui.previewEl.hidden = false
      ui.resultPanel.hidden = false
      ui.deleteButton.hidden = true
      ui.confirmDeleteButton.parentElement!.hidden = false
      ui.submitButton.disabled = true
      ui.pickButton.disabled = true
      break
    case 'deleted':
      ui.statusEl.textContent = 'Artifacts deleted. The hosted URL should now return 404.'
      ui.previewEl.hidden = true
      ui.resultPanel.hidden = true
      ui.submitButton.disabled = true
      ui.pickButton.disabled = false
      break
    case 'error':
      ui.statusEl.textContent = 'Upload could not complete.'
      ui.errorEl.hidden = false
      ui.errorEl.textContent = state.message
      ui.submitButton.disabled = !state.recoverable
      ui.pickButton.disabled = false
      break
    default:
      break
  }
}
