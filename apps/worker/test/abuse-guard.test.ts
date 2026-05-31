import { describe, expect, it, vi } from "vitest";
import { createApp } from "#adapters/hono/app";
import { TURNSTILE_TOKEN_FIELD } from "#adapters/hono/abuse-guard";
import type { ProcessImageJobDeps } from "#core/process-image-job";

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

type WorkerTestDeps = ProcessImageJobDeps & {
  repository: ProcessImageJobDeps["repository"] & { create: ReturnType<typeof vi.fn> };
};

const createDeps = (): WorkerTestDeps => ({
  repository: {
    create: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
    get: vi.fn(async () => null),
    delete: vi.fn(async () => {}),
  },
  objectStore: {
    putOriginal: vi.fn(async () => {}),
    putProcessed: vi.fn(async () => {}),
    getProcessed: vi.fn(async () => null),
    deleteAll: vi.fn(async () => {}),
  },
  provider: {
    removeBackground: vi.fn(async (input: Blob) => input),
  },
  transformer: {
    flipHorizontalAsPng: vi.fn(async (input: Blob) => input),
  },
});

const createForm = (token?: string) => {
  const form = new FormData();
  form.set("file", new File([PNG_BYTES], "sample.png", { type: "image/png" }));
  if (token) {
    form.set(TURNSTILE_TOKEN_FIELD, token);
  }
  return form;
};

const createSecureApp = ({
  deps = createDeps(),
  fetchImpl = vi.fn(),
  turnstile = {},
}: {
  deps?: WorkerTestDeps;
  fetchImpl?: typeof fetch;
  turnstile?: Record<string, unknown>;
} = {}) => ({
  app: createApp({
    ...deps,
    fetchImpl,
    securityConfig: {
      turnstile: {
        siteKey: "site_public_123",
        secretKey: "secret_private_123",
        action: "upload",
        expectedHostname: "edge-matte.ozby.dev",
        timeoutMs: 25,
        ...turnstile,
      },
    } as never,
  }),
  deps,
  fetchImpl,
});

describe("turnstile abuse guard", () => {
  it("rejects missing tokens before processing", async () => {
    const { app, deps, fetchImpl } = createSecureApp();

    const response = await app.fetch(
      new Request("https://edge-matte.ozby.dev/api/jobs", {
        method: "POST",
        body: createForm(),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "invalid_request" } });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(deps.repository.create).not.toHaveBeenCalled();
  });

  it("rejects timeout-or-duplicate siteverify results", async () => {
    const { app, deps } = createSecureApp({
      fetchImpl: vi.fn(async () =>
        Response.json({
          success: false,
          "error-codes": ["timeout-or-duplicate"],
        }),
      ) as typeof fetch,
    });

    const response = await app.fetch(
      new Request("https://edge-matte.ozby.dev/api/jobs", {
        method: "POST",
        body: createForm("token-123"),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "invalid_request" } });
    expect(deps.repository.create).not.toHaveBeenCalled();
  });

  it("rejects hostname mismatches", async () => {
    const { app } = createSecureApp({
      fetchImpl: vi.fn(async () =>
        Response.json({
          success: true,
          hostname: "attacker.example",
          action: "upload",
        }),
      ) as typeof fetch,
    });

    const response = await app.fetch(
      new Request("https://edge-matte.ozby.dev/api/jobs", {
        method: "POST",
        body: createForm("token-123"),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "invalid_request" } });
  });

  it("rejects action mismatches", async () => {
    const { app } = createSecureApp({
      fetchImpl: vi.fn(async () =>
        Response.json({
          success: true,
          hostname: "edge-matte.ozby.dev",
          action: "signup",
        }),
      ) as typeof fetch,
    });

    const response = await app.fetch(
      new Request("https://edge-matte.ozby.dev/api/jobs", {
        method: "POST",
        body: createForm("token-123"),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: "invalid_request" } });
  });

  it("fails loudly when a site key exists without a secret contract", async () => {
    const fetchImpl = vi.fn();
    const { app } = createSecureApp({
      fetchImpl,
      turnstile: {
        secretKey: "",
      },
    });

    const response = await app.fetch(
      new Request("https://edge-matte.ozby.dev/api/jobs", {
        method: "POST",
        body: createForm("token-123"),
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "internal_error" } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects bounded siteverify timeouts", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    const { app, deps } = createSecureApp({
      fetchImpl: vi.fn(async () => {
        throw abortError;
      }) as typeof fetch,
    });

    const response = await app.fetch(
      new Request("https://edge-matte.ozby.dev/api/jobs", {
        method: "POST",
        body: createForm("token-123"),
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "internal_error" } });
    expect(deps.repository.create).not.toHaveBeenCalled();
  });

  it("accepts valid tokens and allows processing to continue", async () => {
    const { app, deps, fetchImpl } = createSecureApp({
      fetchImpl: vi.fn(async () =>
        Response.json({
          success: true,
          hostname: "edge-matte.ozby.dev",
          action: "upload",
        }),
      ) as typeof fetch,
    });

    const response = await app.fetch(
      new Request("https://edge-matte.ozby.dev/api/jobs", {
        method: "POST",
        body: createForm("token-123"),
      }),
    );

    expect(response.status).toBe(201);
    expect(deps.repository.create).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
