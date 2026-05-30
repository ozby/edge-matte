import { describe, expect, it } from "vitest";
import {
  cleanPngMatteEdges,
  decodePngRgba,
  encodePngRgba,
} from "#adapters/cloudflare/png-matte-edge-cleaner";

const pixel = (rgba: Uint8Array, index: number) => Array.from(rgba.slice(index * 4, index * 4 + 4));

describe("PNG matte edge cleaner", () => {
  it("removes low-alpha source-background color while preserving foreground pixels", async () => {
    const input = await encodePngRgba({
      width: 4,
      height: 1,
      rgba: Uint8Array.of(0, 0, 255, 255, 255, 0, 0, 96, 0, 0, 255, 96, 255, 0, 0, 255),
    });

    const cleaned = await cleanPngMatteEdges(input);
    const { rgba } = await decodePngRgba(cleaned);

    expect(pixel(rgba, 0)).toEqual([0, 0, 255, 255]);
    expect(pixel(rgba, 1)).toEqual([0, 0, 0, 0]);
    expect(pixel(rgba, 2)).toEqual([0, 0, 255, 96]);
    expect(pixel(rgba, 3)).toEqual([255, 0, 0, 255]);
  });
});
