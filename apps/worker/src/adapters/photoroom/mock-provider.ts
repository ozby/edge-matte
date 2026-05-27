import type { BackgroundRemovalProvider } from "../../ports";

export class MockBackgroundRemovalProvider implements BackgroundRemovalProvider {
  async removeBackground(input: Blob): Promise<Blob> {
    return input;
  }
}
