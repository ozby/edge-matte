import type { ImageTransformer } from "#ports";

export class MockTransformer implements ImageTransformer {
  async flipHorizontalAsPng(input: Blob): Promise<Blob> {
    return new Blob([await input.arrayBuffer()], { type: "image/png" });
  }
}
