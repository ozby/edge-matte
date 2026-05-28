import type { ImageTransformer } from "#ports";

export class MockTransformer implements ImageTransformer {
  async flipHorizontal(input: Blob, _outputType: string): Promise<Response> {
    return new Response(input.stream(), {
      headers: { "content-type": "image/png" },
    });
  }
}
