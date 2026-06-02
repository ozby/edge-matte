import { describe, expect, it } from "vitest";
import { createUi, renderUi } from "#ui";

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
    // Drop zone must be hidden once a file is selected — two competing affordances are confusing.
    expect(ui.dropZone.hidden).toBe(true);
  });

  it("hides the drop zone in every phase where a file or result already exists", () => {
    const mount = document.createElement("div");
    const ui = createUi(mount);
    const job = {
      id: "job_123",
      status: "ready" as const,
      imageUrl: "https://edge-matte.ozby.dev/i/job_123",
      originalImageUrl: "https://edge-matte.ozby.dev/i/job_123/original",
      resultUrl: "https://edge-matte.ozby.dev/r/job_123",
      pollUrl: "https://edge-matte.ozby.dev/api/jobs/job_123",
      errorCode: null,
      createdAt: "2026-05-27T00:00:00.000Z",
      updatedAt: "2026-05-27T00:00:00.000Z",
    };

    renderUi(ui, { phase: "idle" });
    expect(ui.dropZone.hidden).toBe(false);

    renderUi(ui, {
      phase: "preview",
      previewUrl: "blob:preview",
      fileName: "x.png",
      fileSize: 1024,
    });
    expect(ui.dropZone.hidden).toBe(true);

    renderUi(ui, { phase: "uploading", previewUrl: "blob:preview", fileName: "x.png" });
    expect(ui.dropZone.hidden).toBe(true);

    renderUi(ui, { phase: "ready", previewUrl: "blob:preview", job, deleteToken: "t" });
    expect(ui.dropZone.hidden).toBe(true);

    renderUi(ui, {
      phase: "confirm-delete",
      previewUrl: "blob:preview",
      job,
      deleteToken: "t",
    });
    expect(ui.dropZone.hidden).toBe(true);

    renderUi(ui, { phase: "deleted" });
    expect(ui.dropZone.hidden).toBe(false);

    renderUi(ui, { phase: "error", message: "boom", recoverable: true });
    expect(ui.dropZone.hidden).toBe(false);
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
        originalImageUrl: "https://edge-matte.ozby.dev/i/job_123/original",
        resultUrl: "https://edge-matte.ozby.dev/r/job_123",
        pollUrl: "https://edge-matte.ozby.dev/api/jobs/job_123",
        errorCode: null,
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:00.000Z",
      },
      deleteToken: "secret",
    });
    expect(ui.resultPanel.hidden).toBe(false);
    expect(ui.resultUrl.href).toBe("https://edge-matte.ozby.dev/r/job_123");
    expect(ui.copyButton.disabled).toBe(false);
    expect(ui.downloadButton.href).toBe("https://edge-matte.ozby.dev/i/job_123");
    expect(ui.previewImage.hidden).toBe(true);
    expect(ui.compareEl.hidden).toBe(false);
    expect(ui.compareBeforeImage.src).toBe("blob:preview");
    expect(ui.compareAfterImage.src).toBe("https://edge-matte.ozby.dev/i/job_123");
    // Spinner must be hidden once processing is complete.
    expect(ui.spinner.hidden).toBe(true);
  });

  it("shows the original and transformed images together during delete confirmation", () => {
    const mount = document.createElement("div");
    const ui = createUi(mount);
    renderUi(ui, {
      phase: "confirm-delete",
      previewUrl: "blob:preview",
      job: {
        id: "job_123",
        status: "ready",
        imageUrl: "https://edge-matte.ozby.dev/i/job_123",
        originalImageUrl: "https://edge-matte.ozby.dev/i/job_123/original",
        resultUrl: "https://edge-matte.ozby.dev/r/job_123",
        pollUrl: "https://edge-matte.ozby.dev/api/jobs/job_123",
        errorCode: null,
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:00.000Z",
      },
      deleteToken: "secret",
    });

    expect(ui.resultPanel.hidden).toBe(false);
    expect(ui.deleteConfirm.hidden).toBe(false);
    expect(ui.compareEl.hidden).toBe(false);
    expect(ui.compareBeforeImage.src).toBe("blob:preview");
    expect(ui.compareAfterImage.src).toBe("https://edge-matte.ozby.dev/i/job_123");
  });

  it("renders shared results from persisted original and hides delete without a token", () => {
    const mount = document.createElement("div");
    const ui = createUi(mount);
    renderUi(ui, {
      phase: "ready",
      previewUrl: "https://edge-matte.ozby.dev/i/job_123/original",
      job: {
        id: "job_123",
        status: "ready",
        imageUrl: "https://edge-matte.ozby.dev/i/job_123",
        originalImageUrl: "https://edge-matte.ozby.dev/i/job_123/original",
        resultUrl: "https://edge-matte.ozby.dev/r/job_123",
        pollUrl: "https://edge-matte.ozby.dev/api/jobs/job_123",
        errorCode: null,
        createdAt: "2026-05-27T00:00:00.000Z",
        updatedAt: "2026-05-27T00:00:00.000Z",
      },
      deleteToken: null,
    });

    expect(ui.resultPanel.hidden).toBe(false);
    expect(ui.resultUrl.href).toBe("https://edge-matte.ozby.dev/r/job_123");
    expect(ui.downloadButton.href).toBe("https://edge-matte.ozby.dev/i/job_123");
    expect(ui.compareBeforeImage.src).toBe("https://edge-matte.ozby.dev/i/job_123/original");
    expect(ui.deleteButton.hidden).toBe(true);
    expect(ui.deleteConfirm.hidden).toBe(true);
  });

  it("renders loading and missing result states for direct share pages", () => {
    const mount = document.createElement("div");
    const ui = createUi(mount);

    renderUi(ui, { phase: "result-loading", id: "job_123" });
    expect(ui.statusText.textContent).toContain("Loading result");
    expect(ui.spinner.hidden).toBe(false);
    expect(ui.resultPanel.hidden).toBe(true);

    renderUi(ui, { phase: "result-missing", id: "job_123" });
    expect(ui.errorEl.hidden).toBe(false);
    expect(ui.errorEl.textContent).toContain("That result is no longer available");
    expect(ui.resultPanel.hidden).toBe(true);
  });

  it("compare slider lives inside the frame and drives the split position", () => {
    const mount = document.createElement("div");
    const ui = createUi(mount);

    expect(ui.compareFrame.style.getPropertyValue("--compare-split")).toBe("50%");

    expect(ui.compareFrame.contains(ui.compareSlider)).toBe(true);
    expect(ui.compareBeforeImage.alt).toBe("Original image preview mirrored for comparison");
    expect(mount.textContent).toContain("Original mirrored");
    expect(ui.compareSlider.getAttribute("aria-label")).toBe(
      "Reveal mirrored original versus transformed image",
    );

    ui.compareSlider.value = "30";
    ui.compareSlider.dispatchEvent(new Event("input"));
    expect(ui.compareFrame.style.getPropertyValue("--compare-split")).toBe("30%");

    const job = {
      id: "job_test",
      status: "ready" as const,
      imageUrl: "https://edge-matte.ozby.dev/i/job_test",
      originalImageUrl: "https://edge-matte.ozby.dev/i/job_test/original",
      resultUrl: "https://edge-matte.ozby.dev/r/job_test",
      pollUrl: "https://edge-matte.ozby.dev/api/jobs/job_test",
      errorCode: null,
      createdAt: "2026-05-31T00:00:00.000Z",
      updatedAt: "2026-05-31T00:00:00.000Z",
    };
    renderUi(ui, { phase: "ready", previewUrl: "blob:preview", job, deleteToken: "t" });
    ui.compareSlider.value = "70";
    ui.compareSlider.dispatchEvent(new Event("input"));
    expect(ui.compareFrame.style.getPropertyValue("--compare-split")).toBe("70%");

    renderUi(ui, { phase: "idle" });
    expect(ui.compareSlider.value).toBe("50");
    expect(ui.compareFrame.style.getPropertyValue("--compare-split")).toBe("50%");

    ui.compareSlider.value = "80";
    ui.compareSlider.dispatchEvent(new Event("input"));
    renderUi(ui, { phase: "deleted" });
    expect(ui.compareSlider.value).toBe("50");
    expect(ui.compareFrame.style.getPropertyValue("--compare-split")).toBe("50%");
  });

  it("renders the Ozby network footer links", () => {
    const mount = document.createElement("div");
    createUi(mount);

    const ozbyLink = mount.querySelector<HTMLAnchorElement>('a[href="https://ozby.dev"]');
    const githubLink = mount.querySelector<HTMLAnchorElement>('a[href="https://github.com/ozby"]');
    const linkedInLink = mount.querySelector<HTMLAnchorElement>(
      'a[href="http://linkedin.com/in/ozberk-ercin/"]',
    );

    expect(mount.textContent).toContain("Part of the Ozby network");
    expect(ozbyLink?.textContent).toContain("Ozby");
    expect(githubLink?.textContent).toContain("GitHub");
    expect(linkedInLink?.textContent).toContain("LinkedIn");
  });
});
