import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppForTest, wireAppEvents } from "#app";

const PNG_BYTES = Uint8Array.of(
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0x00,
  0x00,
  0x00,
  0x0d,
  0x49,
  0x48,
  0x44,
  0x52,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01,
);

describe("upload flow controller", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:preview") as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.endsWith("/api/jobs") && init?.method === "POST") {
          return new Response(
            JSON.stringify({
              id: "job_test",
              status: "ready",
              imageUrl: "https://edge-matte.ozby.dev/i/job_test",
              pollUrl: "https://edge-matte.ozby.dev/api/jobs/job_test",
              errorCode: null,
              createdAt: "2026-05-27T00:00:00.000Z",
              updatedAt: "2026-05-27T00:00:00.000Z",
              deleteToken: "delete-token",
            }),
            { status: 201, headers: { "content-type": "application/json" } },
          );
        }
        if (url.includes("/api/jobs/job_test") && init?.method === "DELETE") {
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({ error: { code: "image_not_found" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn(async () => undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs preview -> ready -> confirm delete -> deleted", async () => {
    const mount = document.createElement("div");
    const { app, ui } = createAppForTest(mount);
    const file = new File([PNG_BYTES], "sample.png", { type: "image/png" });

    app.selectFile(file);
    expect(app.getState().phase).toBe("preview");
    expect(ui.submitButton.disabled).toBe(false);

    await app.submitUpload();
    expect(app.getState().phase).toBe("ready");
    expect(ui.resultPanel.hidden).toBe(false);
    expect(ui.resultUrl.textContent).toContain("/i/job_test");
    // Preview must swap to the PROCESSED result, not stay on the original blob URL.
    expect(ui.previewImage.src).toBe("https://edge-matte.ozby.dev/i/job_test");

    app.requestDelete();
    expect(app.getState().phase).toBe("confirm-delete");
    expect(ui.deleteConfirm.hidden).toBe(false);

    await app.confirmDelete();
    expect(app.getState().phase).toBe("deleted");
    expect(ui.resultPanel.hidden).toBe(true);
  });

  it("keeps the object-URL preview alive through upload (does not revoke the displayed blob)", async () => {
    const mount = document.createElement("div");
    const { app, ui } = createAppForTest(mount);
    const file = new File([PNG_BYTES], "sample.png", { type: "image/png" });

    app.selectFile(file);
    expect(app.getState().phase).toBe("preview");
    const displayedBlob = ui.previewImage.src;

    // Enter the uploading phase synchronously, before the network resolves.
    const pending = app.submitUpload();
    expect(app.getState().phase).toBe("uploading");
    // The blob URL the <img> is still showing must NOT have been revoked — revoking
    // it mid-flight is what rendered the preview broken until processing finished.
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(displayedBlob);
    expect(ui.previewImage.src).toBe(displayedBlob);

    await pending;
    // Once ready, the preview swaps to the processed result.
    expect(ui.previewImage.src).toBe("https://edge-matte.ozby.dev/i/job_test");
  });

  it("surfaces recoverable validation errors before upload", () => {
    const mount = document.createElement("div");
    const { app } = createAppForTest(mount);
    const bad = new File([Uint8Array.of(0x00)], "bad.bin", { type: "application/octet-stream" });
    app.selectFile(bad);
    expect(app.getState()).toMatchObject({ phase: "error", recoverable: true });
  });

  describe("wired event handlers", () => {
    const makePngFile = () => new File([PNG_BYTES], "drop.png", { type: "image/png" });

    it("drop event with an image file moves the app into preview", () => {
      const mount = document.createElement("div");
      const { app, ui } = createAppForTest(mount);
      wireAppEvents(ui, app);

      const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(dropEvent, "dataTransfer", {
        value: { files: [makePngFile()] },
      });
      ui.dropZone.dispatchEvent(dropEvent);

      expect(app.getState().phase).toBe("preview");
    });

    it("drop event without files is a safe no-op (does not crash on optional chain)", () => {
      const mount = document.createElement("div");
      const { app, ui } = createAppForTest(mount);
      wireAppEvents(ui, app);

      const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(dropEvent, "dataTransfer", { value: { files: [] } });
      ui.dropZone.dispatchEvent(dropEvent);

      expect(app.getState().phase).toBe("idle");
    });

    it("paste event with an image file moves the app into preview", () => {
      const mount = document.createElement("div");
      const { app, ui } = createAppForTest(mount);
      wireAppEvents(ui, app);

      const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(pasteEvent, "clipboardData", {
        value: { files: [makePngFile()] },
      });
      document.dispatchEvent(pasteEvent);

      expect(app.getState().phase).toBe("preview");
    });

    it.each([
      ["Enter", "Enter key"],
      [" ", "Space key"],
    ])("keydown %s on the drop target opens the file picker", (key) => {
      const mount = document.createElement("div");
      const { app, ui } = createAppForTest(mount);
      wireAppEvents(ui, app);

      const clickSpy = vi.spyOn(ui.fileInput, "click").mockImplementation(() => undefined);
      const dropTarget = ui.dropZone.querySelector(".drop-target");
      if (!(dropTarget instanceof HTMLElement)) throw new Error("drop-target missing");
      dropTarget.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });
});
