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
  let securityConfig: {
    turnstile: { enabled: boolean; siteKey: string | null; action: string };
  };
  let createJobResponse: Response;
  let deleteJobResponse: Response;
  let receivedCreateJobForm: FormData | null;

  beforeEach(() => {
    securityConfig = {
      turnstile: {
        enabled: false,
        siteKey: null,
        action: "upload",
      },
    };
    createJobResponse = new Response(
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
    deleteJobResponse = new Response(null, { status: 204 });
    receivedCreateJobForm = null;
    URL.createObjectURL = vi.fn(() => "blob:preview") as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.url;
        if (url.endsWith("/api/security-config")) {
          return new Response(JSON.stringify(securityConfig), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (url.endsWith("/api/jobs") && init?.method === "POST") {
          receivedCreateJobForm = init.body instanceof FormData ? init.body : null;
          return createJobResponse.clone();
        }
        if (url.includes("/api/jobs/job_test") && init?.method === "DELETE") {
          return deleteJobResponse.clone();
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
    expect(ui.compareEl.hidden).toBe(false);
    expect(ui.compareBeforeImage.src).toBe("blob:preview");
    expect(ui.compareAfterImage.src).toBe("https://edge-matte.ozby.dev/i/job_test");

    app.requestDelete();
    expect(app.getState().phase).toBe("confirm-delete");
    expect(ui.deleteConfirm.hidden).toBe(false);
    expect(ui.compareEl.hidden).toBe(false);

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

    // The submit call must not revoke the blob URL while it is still the active preview.
    const pending = app.submitUpload();
    // The blob URL the <img> is still showing must NOT have been revoked — revoking
    // it mid-flight is what rendered the preview broken until processing finished.
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(displayedBlob);

    await pending;
    expect(ui.compareBeforeImage.src).toBe("blob:preview");
    expect(ui.compareAfterImage.src).toBe("https://edge-matte.ozby.dev/i/job_test");
  });

  it("surfaces recoverable validation errors before upload", () => {
    const mount = document.createElement("div");
    const { app } = createAppForTest(mount);
    const bad = new File([Uint8Array.of(0x00)], "bad.bin", { type: "application/octet-stream" });
    app.selectFile(bad);
    expect(app.getState()).toMatchObject({ phase: "error", recoverable: true });
  });

  it("blocks upload until the Turnstile challenge has produced a token", async () => {
    securityConfig = {
      turnstile: {
        enabled: true,
        siteKey: "site_public_123",
        action: "upload",
      },
    };
    window.turnstile = {
      render: vi.fn(() => "widget-1"),
      reset: vi.fn(),
    };

    const mount = document.createElement("div");
    const { app, ui } = createAppForTest(mount);
    const file = new File([PNG_BYTES], "sample.png", { type: "image/png" });

    app.selectFile(file);
    await vi.waitFor(() => {
      expect(ui.submitButton.disabled).toBe(true);
    });

    await app.submitUpload();

    expect(app.getState()).toMatchObject({
      phase: "error",
      message: "Complete the verification challenge before uploading.",
      recoverable: true,
    });
    expect(receivedCreateJobForm).toBeNull();
  });

  it("sends the challenge token on createJob and resets the widget after submit and delete", async () => {
    securityConfig = {
      turnstile: {
        enabled: true,
        siteKey: "site_public_123",
        action: "upload",
      },
    };
    let onToken: ((token: string) => void) | undefined;
    const reset = vi.fn();
    window.turnstile = {
      render: vi.fn((_, options) => {
        onToken = options.callback;
        return "widget-1";
      }),
      reset,
    };

    const mount = document.createElement("div");
    const { app, ui } = createAppForTest(mount);
    const file = new File([PNG_BYTES], "sample.png", { type: "image/png" });

    await vi.waitFor(() => {
      expect(window.turnstile?.render).toHaveBeenCalledTimes(1);
    });
    onToken?.("token-123");
    app.selectFile(file);

    expect(ui.submitButton.disabled).toBe(false);

    await app.submitUpload();

    expect(receivedCreateJobForm?.get("turnstileToken")).toBe("token-123");
    expect(reset).toHaveBeenCalledTimes(1);

    app.requestDelete();
    await app.confirmDelete();

    expect(reset).toHaveBeenCalledTimes(2);
  });

  it("resets the challenge after upload errors", async () => {
    securityConfig = {
      turnstile: {
        enabled: true,
        siteKey: "site_public_123",
        action: "upload",
      },
    };
    createJobResponse = new Response(JSON.stringify({ error: { code: "invalid_request" } }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });

    let onToken: ((token: string) => void) | undefined;
    const reset = vi.fn();
    window.turnstile = {
      render: vi.fn((_, options) => {
        onToken = options.callback;
        return "widget-1";
      }),
      reset,
    };

    const mount = document.createElement("div");
    const { app } = createAppForTest(mount);
    const file = new File([PNG_BYTES], "sample.png", { type: "image/png" });

    await vi.waitFor(() => {
      expect(window.turnstile?.render).toHaveBeenCalledTimes(1);
    });
    onToken?.("token-123");
    app.selectFile(file);
    await app.submitUpload();

    expect(app.getState()).toMatchObject({ phase: "error", recoverable: true });
    expect(reset).toHaveBeenCalledTimes(1);
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
