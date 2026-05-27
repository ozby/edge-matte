import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
  errorResponse,
  fileTooLargeError,
  imageNotFoundError,
  invalidDeleteTokenError,
  invalidRequestError,
} from "../../core/errors";
import { toPublicImageJob, verifyDeleteToken } from "../../core/image-job";
import {
  MAX_UPLOAD_BYTES,
  processImageJob,
  type ProcessImageJobDeps,
} from "../../core/process-image-job";

const toJsonResponse = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export const createApp = (
  deps: ProcessImageJobDeps & {
    appOrigin: string;
  },
) => {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok", version: "0.1.0" }));

  app.post(
    "/api/jobs",
    bodyLimit({
      maxSize: MAX_UPLOAD_BYTES,
      onError: () => {
        const mapped = errorResponse(fileTooLargeError());
        return toJsonResponse(mapped.body, mapped.status);
      },
    }),
    async (c) => {
      try {
        const body = await c.req.formData();
        const files = body.getAll("file");
        if (files.length !== 1 || !(files[0] instanceof File)) {
          throw invalidRequestError();
        }
        const job = await processImageJob({ file: files[0], appOrigin: deps.appOrigin }, deps);
        return c.json(
          {
            ...toPublicImageJob(job),
            deleteToken: job.deleteToken,
          },
          201,
        );
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

  app.get("/", (c) => c.text("EdgeMatte placeholder service"));

  return app;
};
