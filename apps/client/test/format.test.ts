import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  errorCodeToMessage,
  formatFileSize,
  isTerminalStatus,
  statusLabel,
  validateSelectedFile,
} from "#format";

describe("format helpers", () => {
  it("formats file sizes for UI copy", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("allows images up to the 8 MiB contract and rejects larger files", () => {
    const withinLimit = new File([new Uint8Array(MAX_UPLOAD_BYTES)], "ok.png", {
      type: "image/png",
    });
    expect(validateSelectedFile(withinLimit)).toBeNull();

    const tooLarge = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "big.png", {
      type: "image/png",
    });
    expect(validateSelectedFile(tooLarge)).toBe("Image must be 8 MiB or smaller.");
  });

  it("rejects unsupported files before upload", () => {
    const bad = new File([Uint8Array.of(0x00)], "bad.bin", { type: "application/octet-stream" });
    expect(validateSelectedFile(bad)).toMatch(/PNG, JPEG, or WebP/u);
  });

  it("maps API error codes to actionable messages", () => {
    expect(errorCodeToMessage("file_too_large")).toBe(
      "That file is too large. Use an image up to 8 MiB.",
    );
    expect(errorCodeToMessage("image_not_found")).toMatch(/no longer exists/u);
  });

  it("labels processing states for progress UI", () => {
    expect(statusLabel("removing_background")).toMatch(/background/u);
    expect(isTerminalStatus("ready")).toBe(true);
    expect(isTerminalStatus("uploading")).toBe(false);
  });
});
