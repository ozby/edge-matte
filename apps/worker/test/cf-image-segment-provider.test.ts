import { afterEach, describe, expect, it, vi } from "vitest";
import { CfImageSegmentProvider } from "#adapters/cloudflare/cf-image-segment-provider";
import { encodePngRgba } from "#adapters/cloudflare/png-matte-edge-cleaner";

const PNG_BYTES = Uint8Array.of(0x89, 0x50, 0x4e, 0x47);

const createValidPngBytes = async () =>
  new Uint8Array(
    await (
      await encodePngRgba({
        width: 1,
        height: 1,
        rgba: Uint8Array.of(0, 0, 255, 255),
      })
    ).arrayBuffer(),
  );

const createImagesBindingStub = async (cutoutBytes?: Uint8Array) => {
  const response = vi.fn(
    async () =>
      new Response(new Blob([cutoutBytes ?? (await createValidPngBytes())]).stream(), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
  );
  const output = vi.fn(async () => ({ response }));
  const transform = vi.fn((_options: { segment?: "foreground" }) => ({ output }));
  const input = vi.fn((_stream: ReadableStream) => ({ transform }));
  return {
    input,
    transform,
    output,
    response,
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CfImageSegmentProvider", () => {
  it("streams the upload through the IMAGES binding segment transform and returns the cutout", async () => {
    const cutoutBytes = await createValidPngBytes();
    const images = await createImagesBindingStub(cutoutBytes);
    const provider = new CfImageSegmentProvider(images as never);
    const result = await provider.removeBackground(new Blob([PNG_BYTES], { type: "image/png" }));

    expect(new Uint8Array(await result.arrayBuffer())).toStrictEqual(cutoutBytes);
    expect(images.input).toHaveBeenCalledOnce();
    expect(images.transform).toHaveBeenCalledWith({ segment: "foreground" });
    expect(images.output).toHaveBeenCalledWith({ format: "image/png" });
    expect(images.response).toHaveBeenCalledOnce();
  });

  it("maps an IMAGES binding failure to a 502 background_provider_failed", async () => {
    const images = {
      input: vi.fn(() => ({
        transform: vi.fn(() => ({
          output: vi.fn(async () => {
            throw new Error("upstream boom");
          }),
        })),
      })),
    };
    const provider = new CfImageSegmentProvider(images as never);

    await expect(
      provider.removeBackground(new Blob([PNG_BYTES], { type: "image/png" })),
    ).rejects.toMatchObject({ code: "background_provider_failed", status: 502 });
  });
});
