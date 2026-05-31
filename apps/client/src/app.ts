import { createJob, deleteJob, pollJobUntilTerminal } from "./api";
import { errorCodeToMessage, validateSelectedFile } from "./format";
import { createSecurityController } from "./security";
import { canSelectFile, canSubmitUpload, initialUiState, type UiPhase } from "./state";
import { createUi, renderUi, type UiElements } from "./ui";

export interface AppController {
  getState: () => UiPhase;
  selectFile: (file: File) => void;
  submitUpload: () => Promise<void>;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  reset: () => void;
  copyResultUrl: () => Promise<void>;
}

const previewBlobUrl = (state: UiPhase): string | null =>
  "previewUrl" in state && state.previewUrl.startsWith("blob:") ? state.previewUrl : null;

// Revoke the outgoing blob URL only when the incoming state no longer references
// it. uploading/processing/ready all carry the same previewUrl forward, so revoking
// on every transition would invalidate the <img> the next state still displays —
// the preview rendered broken until processing finished.
const revokeReplacedBlob = (previous: UiPhase, next: UiPhase): void => {
  const previousUrl = previewBlobUrl(previous);
  if (previousUrl && previousUrl !== previewBlobUrl(next)) {
    URL.revokeObjectURL(previousUrl);
  }
};

export const createApp = (mount: HTMLElement): AppController => {
  const ui = createUi(mount);
  const controller = buildApp(ui);
  wireAppEvents(ui, controller);
  return controller;
};

const buildApp = (ui: UiElements): AppController => {
  let state: UiPhase = initialUiState();
  let selectedFile: File | null = null;
  let deleteToken: string | null = null;

  const syncUi = (): void => {
    renderUi(ui, state);
    const canRetrySubmit =
      state.phase === "preview" || (state.phase === "error" && state.recoverable);
    const disableForSecurity =
      canRetrySubmit &&
      security.requiresToken() &&
      !security.isPending() &&
      !security.isUnavailable() &&
      !security.getToken();
    if (disableForSecurity) {
      ui.submitButton.disabled = true;
    }
  };

  const security = createSecurityController(ui.securityChallenge, syncUi);

  const setState = (next: UiPhase): void => {
    revokeReplacedBlob(state, next);
    state = next;
    syncUi();
  };

  const selectFile = (file: File): void => {
    if (!canSelectFile(state)) return;
    const validationError = validateSelectedFile(file);
    if (validationError) {
      setState({ phase: "error", message: validationError, recoverable: true });
      return;
    }
    selectedFile = file;
    deleteToken = null;
    setState({
      phase: "preview",
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
      fileSize: file.size,
    });
  };

  const submitUpload = async (): Promise<void> => {
    if (!canSubmitUpload(state) || !selectedFile) return;
    await security.ready;
    if (security.requiresToken()) {
      if (security.isUnavailable()) {
        setState({
          phase: "error",
          message: "Verification is unavailable right now. Refresh and try again.",
          recoverable: true,
        });
        return;
      }
      if (!security.getToken()) {
        setState({
          phase: "error",
          message: "Complete the verification challenge before uploading.",
          recoverable: true,
        });
        return;
      }
    }
    const previewUrl =
      state.phase === "preview" ? state.previewUrl : URL.createObjectURL(selectedFile);
    const fileName = selectedFile.name;
    setState({ phase: "uploading", previewUrl, fileName });
    try {
      const created = await createJob(selectedFile, {
        turnstileToken: security.getToken(),
      });
      security.reset();
      deleteToken = created.deleteToken;
      if (created.status === "ready") {
        setState({
          phase: "ready",
          previewUrl,
          job: created,
          deleteToken: created.deleteToken,
        });
        return;
      }
      setState({
        phase: "processing",
        previewUrl,
        jobId: created.id,
        status: created.status,
      });
      const job = await pollJobUntilTerminal(created.id, {
        onAttempt: (attempt, max) => {
          if (attempt >= Math.floor(max * 0.75) && state.phase === "processing") {
            setState({ ...state, status: "reconnecting" });
          }
        },
      });
      if (job.status === "failed") {
        setState({
          phase: "error",
          message: errorCodeToMessage(job.errorCode),
          recoverable: true,
        });
        return;
      }
      setState({
        phase: "ready",
        previewUrl,
        job,
        deleteToken: deleteToken ?? created.deleteToken,
      });
    } catch (error) {
      security.reset();
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : errorCodeToMessage(null),
        recoverable: true,
      });
    }
  };

  const requestDelete = (): void => {
    if (state.phase !== "ready") return;
    setState({ ...state, phase: "confirm-delete" });
  };

  const cancelDelete = (): void => {
    if (state.phase !== "confirm-delete") return;
    setState({ ...state, phase: "ready" });
  };

  const confirmDelete = async (): Promise<void> => {
    if (state.phase !== "confirm-delete" || !deleteToken) return;
    try {
      await deleteJob(state.job.id, deleteToken);
      security.reset();
      selectedFile = null;
      deleteToken = null;
      setState({ phase: "deleted" });
    } catch (error) {
      security.reset();
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : errorCodeToMessage(null),
        recoverable: false,
      });
    }
  };

  const reset = (): void => {
    selectedFile = null;
    deleteToken = null;
    security.reset();
    ui.fileInput.value = "";
    setState(initialUiState());
  };

  const copyResultUrl = async (): Promise<void> => {
    if (state.phase !== "ready" && state.phase !== "confirm-delete") return;
    await navigator.clipboard.writeText(state.job.imageUrl);
    ui.copyButton.textContent = "Copied!";
    window.setTimeout(() => {
      ui.copyButton.textContent = "Copy URL";
    }, 1500);
  };

  syncUi();

  return {
    getState: () => state,
    selectFile,
    submitUpload,
    requestDelete,
    cancelDelete,
    confirmDelete,
    reset,
    copyResultUrl,
  };
};

export const createAppForTest = (mount: HTMLElement): { ui: UiElements; app: AppController } => {
  const ui = createUi(mount);
  const app = buildApp(ui);
  return { ui, app };
};

export const wireAppEvents = (ui: UiElements, app: AppController): void => {
  ui.pickButton.addEventListener("click", () => ui.fileInput.click());
  ui.fileInput.addEventListener("change", () => {
    const file = ui.fileInput.files?.[0];
    if (file) app.selectFile(file);
    ui.fileInput.value = "";
  });
  ui.submitButton.addEventListener("click", () => {
    void app.submitUpload();
  });
  ui.deleteButton.addEventListener("click", () => app.requestDelete());
  ui.cancelDeleteButton.addEventListener("click", () => app.cancelDelete());
  ui.confirmDeleteButton.addEventListener("click", () => {
    void app.confirmDelete();
  });
  ui.resetButton.addEventListener("click", () => app.reset());
  ui.copyButton.addEventListener("click", () => {
    void app.copyResultUrl();
  });

  // Drop zone — click on the visual target opens the file picker
  const dropTarget = ui.dropZone.querySelector(".drop-target");
  if (dropTarget instanceof HTMLElement) {
    dropTarget.addEventListener("click", () => ui.fileInput.click());
    dropTarget.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        ui.fileInput.click();
      }
    });
  }

  // Drag-and-drop
  ui.dropZone.addEventListener("dragenter", (e: DragEvent) => {
    e.preventDefault();
    ui.dropZone.classList.add("drag-over");
  });
  ui.dropZone.addEventListener("dragover", (e: DragEvent) => {
    e.preventDefault();
    ui.dropZone.classList.add("drag-over");
  });
  ui.dropZone.addEventListener("dragleave", (e: DragEvent) => {
    if (!ui.dropZone.contains(e.relatedTarget as Node | null)) {
      ui.dropZone.classList.remove("drag-over");
    }
  });
  ui.dropZone.addEventListener("drop", (e: DragEvent) => {
    e.preventDefault();
    ui.dropZone.classList.remove("drag-over");
    const file = e.dataTransfer?.files[0];
    if (file) app.selectFile(file);
  });

  // Paste from clipboard
  document.addEventListener("paste", (e: ClipboardEvent) => {
    const file = e.clipboardData?.files[0];
    if (file) app.selectFile(file);
  });
};
