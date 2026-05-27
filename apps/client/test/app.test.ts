import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppForTest } from "../src/app";

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

    app.requestDelete();
    expect(app.getState().phase).toBe("confirm-delete");
    expect(ui.confirmDeleteButton.parentElement?.hidden).toBe(false);

    await app.confirmDelete();
    expect(app.getState().phase).toBe("deleted");
    expect(ui.resultPanel.hidden).toBe(true);
  });

  it("surfaces recoverable validation errors before upload", () => {
    const mount = document.createElement("div");
    const { app } = createAppForTest(mount);
    const bad = new File([Uint8Array.of(0x00)], "bad.bin", { type: "application/octet-stream" });
    app.selectFile(bad);
    expect(app.getState()).toMatchObject({ phase: "error", recoverable: true });
  });
});
