import { afterEach, describe, expect, it, vi } from "vitest";
import { CfImageSegmentProvider } from "#adapters/cloudflare/cf-image-segment-provider";
import { SEGMENT_TMP_PREFIX } from "#core/object-keys";

const PNG_BYTES = Uint8Array.of(0x89, 0x50, 0x4e, 0x47);

// Minimal R2Bucket stub — only the methods the provider touches. put records the
// transient key so each test can prove the finally-cleanup deletes exactly it.
const createBucketStub = () => {
  const put = vi.fn(async () => undefined);
  const del = vi.fn(async () => undefined);
  return { put, delete: del } as unknown as R2Bucket & {
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CfImageSegmentProvider", () => {
  it("stores a transient blob, sub-requests cf.image segment, and returns the cutout", async () => {
    const bucket = createBucketStub();
    const cutout = new Blob([PNG_BYTES], { type: "image/png" });
    const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      // Sub-request must target the Worker's own raw-serving route for the temp key,
      // and must carry the cf.image segment transform + the caller's abort signal.
      expect(url).toContain("/internal/raw/");
      expect(url).toContain(encodeURIComponent(SEGMENT_TMP_PREFIX));
      expect((init?.cf as { image?: { segment?: string } })?.image?.segment).toBe("foreground");
      return new Response(cutout.stream(), { status: 200, headers: { "content-type": "image/png" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CfImageSegmentProvider(bucket, "https://edge-matte.ozby.dev");
    const result = await provider.removeBackground(new Blob([PNG_BYTES], { type: "image/png" }));

    expect(new Uint8Array(await result.arrayBuffer())).toStrictEqual(PNG_BYTES);
    expect(fetchMock).toHaveBeenCalledOnce();

    // The temp blob is written under the segment-tmp prefix, then deleted in finally.
    const putKey = bucket.put.mock.calls[0]?.[0] as string;
    expect(putKey.startsWith(SEGMENT_TMP_PREFIX)).toBe(true);
    expect(bucket.delete).toHaveBeenCalledWith(putKey);
  });

  it("maps a non-ok cf.image response to a 502 background_provider_failed and still cleans up", async () => {
    const bucket = createBucketStub();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream boom", { status: 500 })),
    );

    const provider = new CfImageSegmentProvider(bucket, "https://edge-matte.ozby.dev");

    await expect(
      provider.removeBackground(new Blob([PNG_BYTES], { type: "image/png" })),
    ).rejects.toMatchObject({ code: "background_provider_failed", status: 502 });

    // Cleanup runs in finally even though the transform failed — no orphan temp blob.
    const putKey = bucket.put.mock.calls[0]?.[0] as string;
    expect(bucket.delete).toHaveBeenCalledWith(putKey);
  });

  it("propagates the caller's abort signal to the cf.image sub-request", async () => {
    const bucket = createBucketStub();
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal);
      return new Response(new Blob([PNG_BYTES]).stream(), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new CfImageSegmentProvider(bucket, "https://edge-matte.ozby.dev");
    await provider.removeBackground(new Blob([PNG_BYTES], { type: "image/png" }), controller.signal);

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
