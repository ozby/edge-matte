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
  });
});
