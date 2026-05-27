import { errorCodeToMessage } from "./format";
import type { CreateJobResponse, ErrorCode, PublicImageJob } from "./types";

const parseError = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: { code?: ErrorCode } };
    return errorCodeToMessage(body.error?.code ?? null);
  } catch {
    return errorCodeToMessage(null);
  }
};

export const createJob = async (file: File): Promise<CreateJobResponse> => {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/jobs", { method: "POST", body: form });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as CreateJobResponse;
};

export const fetchJob = async (id: string): Promise<PublicImageJob> => {
  const response = await fetch(`/api/jobs/${id}`);
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as PublicImageJob;
};

export const deleteJob = async (id: string, deleteToken: string): Promise<void> => {
  const response = await fetch(`/api/jobs/${id}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deleteToken }),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
};

export const pollJobUntilTerminal = async (
  id: string,
  options: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<PublicImageJob> => {
  const intervalMs = options.intervalMs ?? 250;
  const maxAttempts = options.maxAttempts ?? 40;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const job = await fetchJob(id);
    if (job.status === "ready" || job.status === "failed") {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Processing is taking longer than expected. Try again.");
};
