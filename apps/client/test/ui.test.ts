import { describe, expect, it } from "vitest";
import { createUi, renderUi } from "../src/ui";

describe("ui rendering", () => {
  it("shows progress and disables upload while processing", () => {
    const mount = document.createElement("div");
    const ui = createUi(mount);
    renderUi(ui, {
      phase: "processing",
      previewUrl: "blob:preview",
      jobId: "job_123",
      status: "flipping",
    });
    expect(ui.statusEl.textContent).toMatch(/Flipping/u);
    expect(ui.submitButton.disabled).toBe(true);
    expect(ui.resultPanel.hidden).toBe(true);
    // Spinner must be visible during active processing so users know work is happening.
    expect(ui.spinner.hidden).toBe(false);
    // Preview shows the original during processing — result is not ready yet.
    expect(ui.previewImage.src).toBe("blob:preview");
  });

  it("reveals hosted URL actions when ready", () => {
    const mount = document.createElement("div");
    const ui = createUi(mount);
    renderUi(ui, {
      phase: "ready",
      previewUrl: "blob:preview",
      job: {
        id: "job_123",
        status: "ready",
        imageUrl: "https://edge-matte.ozby.dev/i/job_123",
        pollUrl: "https://edge-matte.ozby.dev/api/jobs/job_123",
        errorCode: null,
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:00.000Z",
      },
      deleteToken: "secret",
    });
    expect(ui.resultPanel.hidden).toBe(false);
    expect(ui.resultUrl.href).toBe("https://edge-matte.ozby.dev/i/job_123");
    expect(ui.copyButton.disabled).toBe(false);
    // The preview must show the PROCESSED result, not the original upload.
    expect(ui.previewImage.src).toBe("https://edge-matte.ozby.dev/i/job_123");
    // Spinner must be hidden once processing is complete.
    expect(ui.spinner.hidden).toBe(true);
  });
});
