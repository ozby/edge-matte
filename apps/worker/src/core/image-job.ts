import { deriveObjectKeys } from "./object-keys";

export type ImageJobStatus =
  | "validating"
  | "uploading"
  | "removing_background"
  | "flipping"
  | "ready"
  | "failed";

export interface ImageJob {
  id: string;
  status: ImageJobStatus;
  imageUrl: string;
  pollUrl: string;
  originalObjectKey: string;
  processedObjectKey: string;
  deleteTokenHash: string;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedImageJob {
  job: ImageJob;
  deleteToken: string;
}

export interface PublicImageJob {
  id: string;
  status: ImageJobStatus;
  imageUrl: string;
  pollUrl: string;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const hashToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(digest);
};

const createId = (): string => `job_${crypto.randomUUID().replaceAll("-", "")}`;
const createDeleteToken = (): string => crypto.randomUUID().replaceAll("-", "");

export const verifyDeleteToken = async (expectedHash: string, token: string): Promise<boolean> =>
  expectedHash === (await hashToken(token));

export const createImageJob = async ({
  id = createId(),
  appOrigin,
}: {
  id?: string;
  appOrigin: string;
}): Promise<CreatedImageJob> => {
  const now = new Date().toISOString();
  const deleteToken = createDeleteToken();
  const keys = deriveObjectKeys(id);
  return {
    job: {
      id,
      status: "validating",
      imageUrl: `${appOrigin}/i/${id}`,
      pollUrl: `${appOrigin}/api/jobs/${id}`,
      originalObjectKey: keys.original,
      processedObjectKey: keys.processed,
      deleteTokenHash: await hashToken(deleteToken),
      errorCode: null,
      createdAt: now,
      updatedAt: now,
    },
    deleteToken,
  };
};

export const toPublicImageJob = (job: ImageJob): PublicImageJob => ({
  id: job.id,
  status: job.status,
  imageUrl: job.imageUrl,
  pollUrl: job.pollUrl,
  errorCode: job.errorCode,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
});
