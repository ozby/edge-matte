import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  createTurnstileAbuseGuard,
  type TurnstileSecurityConfig,
} from "./abuse-guard";
import {
  errorResponse,
  fileTooLargeError,
  imageNotFoundError,
  invalidDeleteTokenError,
  invalidRequestError,
} from "#core/errors";
import { toPublicImageJob, verifyDeleteToken } from "#core/image-job";
import {
  MAX_UPLOAD_BYTES,
  processImageJob,
  type ProcessImageJobDeps,
} from "#core/process-image-job";

const toJsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// Baseline security headers — applied to every response, including SPA assets.
// Self-host fonts means we don't need third-party allowances for googleapis/gstatic.
const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self'",
    "font-src 'self'",
    "script-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

type PublicSecurityConfig = {
  turnstile: {
    enabled: boolean;
    siteKey: string | null;
    action: string;
  };
};

type WorkerSecurityConfigInput = {
  turnstile?: TurnstileSecurityConfig;
};

const DEFAULT_TURNSTILE_ACTION = "upload";

const toPublicSecurityConfig = (config?: WorkerSecurityConfigInput): PublicSecurityConfig => {
  const siteKey = config?.turnstile?.siteKey ?? null;
  const action = config?.turnstile?.action ?? DEFAULT_TURNSTILE_ACTION;

  return {
    turnstile: {
      enabled: typeof siteKey === "string" && siteKey.length > 0,
      siteKey,
      action,
    },
  };
};

export const createApp = (
  deps: ProcessImageJobDeps & {
    assets?: Fetcher;
    securityConfig?: WorkerSecurityConfigInput;
    fetchImpl?: typeof fetch;
  },
) => {
  const app = new Hono();
  const publicSecurityConfig = toPublicSecurityConfig(deps.securityConfig);

  app.onError((error) => {
    const mapped = errorResponse(error);
    return toJsonResponse(mapped.body, mapped.status);
  });

  // Reconstruct the response so headers apply even on responses returned from
  // env.ASSETS.fetch() (Workers Static Assets returns Response objects with
  // immutable headers — .set() on those would silently no-op).
  app.use("*", async (c, next) => {
    await next();
    const merged = new Headers(c.res.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      merged.set(name, value);
    }
    c.res = new Response(c.res.body, {
      status: c.res.status,
      statusText: c.res.statusText,
      headers: merged,
    });
  });

  app.get("/health", (c) => c.json({ status: "ok", version: "0.1.0" }));

  app.get("/api/security-config", (c) => c.json(publicSecurityConfig));

  app.post(
    "/api/jobs",
    bodyLimit({
      maxSize: MAX_UPLOAD_BYTES,
      onError: () => {
        const mapped = errorResponse(fileTooLargeError());
        return toJsonResponse(mapped.body, mapped.status);
      },
    }),
    createTurnstileAbuseGuard({
      turnstile: deps.securityConfig?.turnstile,
      fetchImpl: deps.fetchImpl,
    }),
    async (c) => {
      try {
        const body = await c.req.formData();
        const files = body.getAll("file");
        if (files.length !== 1 || !(files[0] instanceof File)) {
          throw invalidRequestError();
        }
        // Derive the user-facing origin from the actual request so /i/:id and the
        // pollUrl come back same-origin (CSP 'self' works in both production and
        // local dev).
        const requestOrigin = new URL(c.req.url).origin;
        const { job, deleteToken } = await processImageJob(
          { file: files[0], appOrigin: requestOrigin },
          deps,
        );
        return c.json({ ...toPublicImageJob(job), deleteToken }, 201);
      } catch (error) {
        const mapped = errorResponse(error);
        return toJsonResponse(mapped.body, mapped.status);
      }
    },
  );

  app.get("/api/jobs/:id", async (c) => {
    const job = await deps.repository.get(c.req.param("id"));
    if (!job) {
      const mapped = errorResponse(imageNotFoundError());
      return toJsonResponse(mapped.body, mapped.status);
    }
    return c.json(toPublicImageJob(job));
  });

  app.get("/i/:id", async (c) => {
    const image = await deps.objectStore.getProcessed(c.req.param("id"));
    if (!image) {
      const mapped = errorResponse(imageNotFoundError());
      return toJsonResponse(mapped.body, mapped.status);
    }
    return image;
  });

  app.delete("/api/jobs/:id", async (c) => {
    const id = c.req.param("id");
    const job = await deps.repository.get(id);
    if (!job) {
      const mapped = errorResponse(imageNotFoundError());
      return toJsonResponse(mapped.body, mapped.status);
    }

    try {
      const payload = (await c.req.json()) as { deleteToken?: string };
      if (typeof payload.deleteToken !== "string" || payload.deleteToken.length === 0) {
        throw invalidRequestError();
      }
      if (!(await verifyDeleteToken(job.deleteTokenHash, payload.deleteToken))) {
        throw invalidDeleteTokenError();
      }
      await deps.objectStore.deleteAll(job);
      await deps.repository.delete(id);
      return new Response(null, { status: 204 });
    } catch (error) {
      const mapped = errorResponse(error);
      return toJsonResponse(mapped.body, mapped.status);
    }
  });

  app.all("/internal/*", () => new Response("not found", { status: 404 }));

  // Catch-all: SPA shell + static assets. With `assets.run_worker_first = true`
  // in wrangler.toml, every request hits the Worker first; we proxy non-API routes
  // to the ASSETS binding so the security-headers middleware applies uniformly.
  // The in-memory dev/test path has no ASSETS binding — return a small placeholder
  // there so existing tests (createWorkerApp() without env) stay stable.
  app.all("*", (c) => {
    if (deps.assets) return deps.assets.fetch(c.req.raw);
    return c.text("EdgeMatte placeholder service");
  });

  return app;
};
