import { formatFileSize, statusLabel } from "./format";
import type { UiPhase } from "./state";

export interface UiElements {
  root: HTMLElement;
  fileInput: HTMLInputElement;
  pickButton: HTMLButtonElement;
  submitButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  statusEl: HTMLElement;
  statusText: HTMLElement;
  spinner: HTMLElement;
  previewEl: HTMLElement;
  previewImage: HTMLImageElement;
  metaEl: HTMLElement;
  resultPanel: HTMLElement;
  resultUrl: HTMLAnchorElement;
  copyButton: HTMLButtonElement;
  downloadButton: HTMLAnchorElement;
  deleteButton: HTMLButtonElement;
  confirmDeleteButton: HTMLButtonElement;
  cancelDeleteButton: HTMLButtonElement;
  errorEl: HTMLElement;
  dropZone: HTMLElement;
}

export const createUi = (mount: HTMLElement): UiElements => {
  mount.innerHTML = `
    <main class="edge-matte">
      <header>
        <div class="brand">
          <svg class="brand-icon" viewBox="0 0 28 28" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <rect width="28" height="28" rx="7" fill="url(#bgrad)"/>
            <path d="M8 20 L14 8 L20 20" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <circle cx="14" cy="8" r="2" fill="#00d2ff"/>
            <defs>
              <linearGradient id="bgrad" x1="0" y1="0" x2="28" y2="28">
                <stop offset="0%" stop-color="#1c2030"/>
                <stop offset="100%" stop-color="#0e1420"/>
              </linearGradient>
            </defs>
          </svg>
          <h1>EdgeMatte</h1>
        </div>
        <p class="tagline">Upload an image &rarr; background removed at the edge &rarr; get a hosted URL.</p>
      </header>

      <div class="panel" role="region" aria-label="Image upload">

        <div id="drop-zone" class="drop-zone">
          <input id="file-input" type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label="Choose image file" />
          <div class="drop-target" role="button" tabindex="0" aria-label="Drop image here or click to choose">
            <svg class="drop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 16.5V19a1 1 0 001 1h14a1 1 0 001-1v-2.5"/>
              <path d="M12 3v13"/>
              <path d="M8.5 7.5 12 4l3.5 3.5"/>
            </svg>
            <span class="drop-label">Drop image here</span>
            <span class="drop-sub">PNG, JPEG, WebP &middot; up to 8 MB</span>
          </div>
        </div>

        <div class="action-bar">
          <button id="pick-file" type="button" class="btn btn-secondary">Choose file</button>
          <button id="submit-upload" type="button" class="btn btn-primary" disabled>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="16 16 12 12 8 16"/>
              <line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
            </svg>
            Upload &amp; process
          </button>
          <button id="reset-flow" type="button" class="btn btn-ghost" hidden>Start over</button>
        </div>

        <div class="status-row">
          <p id="status" aria-live="polite" aria-atomic="true">
            <span id="spinner" aria-hidden="true" hidden></span>
            <span id="status-text">Select or drop an image to begin.</span>
          </p>
        </div>

        <p id="error" class="error" role="alert" hidden></p>

        <figure id="preview" class="preview" hidden>
          <img id="preview-image" alt="Image preview" />
          <figcaption id="preview-meta"></figcaption>
        </figure>

        <section id="result" aria-label="Result" hidden>
          <div class="result-header">
            <span class="result-badge">
              <span class="result-badge-dot" aria-hidden="true"></span>
              Live
            </span>
          </div>
          <div class="result-url-row">
            <a id="result-url" href="#" target="_blank" rel="noopener noreferrer" aria-label="Open hosted result"></a>
          </div>
          <div class="result-actions">
            <button id="copy-url" type="button" class="btn btn-secondary" aria-label="Copy URL to clipboard">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              Copy URL
            </button>
            <a id="download-result" class="btn btn-secondary" download aria-label="Download result image">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </a>
            <button id="delete-job" type="button" class="btn btn-ghost" aria-label="Delete hosted artifacts">Delete</button>
          </div>

          <div id="delete-confirm" hidden>
            <p class="delete-confirm-text">This will permanently remove the hosted image. This action cannot be undone.</p>
            <div class="delete-confirm-actions">
              <button id="confirm-delete" type="button" class="btn btn-danger">Yes, delete</button>
              <button id="cancel-delete" type="button" class="btn btn-ghost">Cancel</button>
            </div>
          </div>
        </section>

      </div>

      <footer class="site-footer">
        <p>Processed at the edge &middot; Cloudflare Workers</p>
      </footer>
    </main>
  `;

  const query = <T extends HTMLElement>(id: string): T => {
    const el = mount.querySelector(`#${id}`);
    if (!el) throw new Error(`Missing #${id}`);
    return el as T;
  };

  return {
    root: mount,
    fileInput: query("file-input"),
    pickButton: query("pick-file"),
    submitButton: query("submit-upload"),
    resetButton: query("reset-flow"),
    statusEl: query("status"),
    statusText: query("status-text"),
    spinner: query("spinner"),
    previewEl: query("preview"),
    previewImage: query("preview-image"),
    metaEl: query("preview-meta"),
    resultPanel: query("result"),
    resultUrl: query("result-url"),
    copyButton: query("copy-url"),
    downloadButton: query("download-result"),
    deleteButton: query("delete-job"),
    confirmDeleteButton: query("confirm-delete"),
    cancelDeleteButton: query("cancel-delete"),
    errorEl: query("error"),
    dropZone: query("drop-zone"),
  };
};

const TRANSIENT_PHASES = new Set<UiPhase["phase"]>(["uploading", "processing"]);
const DROP_ZONE_VISIBLE_PHASES = new Set<UiPhase["phase"]>(["idle", "deleted", "error"]);

export const renderUi = (ui: UiElements, state: UiPhase): void => {
  ui.errorEl.hidden = true;
  ui.errorEl.textContent = "";
  ui.resetButton.hidden = state.phase === "idle";
  ui.spinner.hidden = !TRANSIENT_PHASES.has(state.phase);
  ui.dropZone.hidden = !DROP_ZONE_VISIBLE_PHASES.has(state.phase);

  switch (state.phase) {
    case "idle":
      ui.statusText.textContent = "Select or drop an image to begin.";
      ui.previewEl.hidden = true;
      ui.resultPanel.hidden = true;
      ui.submitButton.disabled = true;
      ui.pickButton.disabled = false;
      ui.deleteButton.hidden = false;
      ui.confirmDeleteButton.parentElement!.hidden = true;
      break;
    case "preview":
      ui.statusText.textContent = `Ready — ${state.fileName} (${formatFileSize(state.fileSize)})`;
      ui.previewEl.hidden = false;
      ui.previewImage.src = state.previewUrl;
      ui.metaEl.textContent = state.fileName;
      ui.resultPanel.hidden = true;
      ui.submitButton.disabled = false;
      ui.pickButton.disabled = false;
      break;
    case "uploading":
      ui.statusText.textContent = "Uploading…";
      ui.previewEl.hidden = false;
      ui.previewImage.src = state.previewUrl;
      ui.metaEl.textContent = state.fileName;
      ui.resultPanel.hidden = true;
      ui.submitButton.disabled = true;
      ui.pickButton.disabled = true;
      break;
    case "processing":
      ui.statusText.textContent = statusLabel(state.status);
      ui.previewEl.hidden = false;
      ui.previewImage.src = state.previewUrl;
      ui.metaEl.textContent = `Job ${state.jobId}`;
      ui.resultPanel.hidden = true;
      ui.submitButton.disabled = true;
      ui.pickButton.disabled = true;
      break;
    case "ready":
      ui.statusText.textContent = "Done. Your image is live.";
      ui.previewEl.hidden = false;
      ui.previewImage.src = state.job.imageUrl;
      ui.metaEl.textContent = state.job.id;
      ui.resultPanel.hidden = false;
      ui.resultUrl.href = state.job.imageUrl;
      ui.resultUrl.textContent = state.job.imageUrl;
      ui.downloadButton.href = state.job.imageUrl;
      ui.downloadButton.download = `${state.job.id}.png`;
      ui.deleteButton.hidden = false;
      ui.confirmDeleteButton.parentElement!.hidden = true;
      ui.submitButton.disabled = true;
      ui.pickButton.disabled = true;
      break;
    case "confirm-delete":
      ui.statusText.textContent = "Confirm deletion below.";
      ui.previewEl.hidden = false;
      ui.resultPanel.hidden = false;
      ui.deleteButton.hidden = true;
      ui.confirmDeleteButton.parentElement!.hidden = false;
      ui.submitButton.disabled = true;
      ui.pickButton.disabled = true;
      break;
    case "deleted":
      ui.statusText.textContent = "Artifacts deleted — the hosted URL now returns 404.";
      ui.previewEl.hidden = true;
      ui.resultPanel.hidden = true;
      ui.submitButton.disabled = true;
      ui.pickButton.disabled = false;
      break;
    case "error":
      ui.statusText.textContent = "Could not complete.";
      ui.errorEl.hidden = false;
      ui.errorEl.textContent = state.message;
      ui.submitButton.disabled = !state.recoverable;
      ui.pickButton.disabled = false;
      break;
    default:
      break;
  }
};
