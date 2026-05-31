import { AppError, invalidRequestError } from "#core/errors";
import type { MiddlewareHandler } from "hono";

export const TURNSTILE_TOKEN_FIELD = "cf-turnstile-response";
const DEFAULT_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEFAULT_TIMEOUT_MS = 3_000;

export type TurnstileSecurityConfig = {
  siteKey?: string | null;
  secretKey?: string | null;
  action?: string | null;
  expectedHostname?: string | null;
  verifyUrl?: string | null;
  timeoutMs?: number | null;
};

type TurnstileSiteverifyResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

const hasValue = (value: string | null | undefined): value is string => value != null && value.length > 0;

export const isTurnstileEnabled = (config?: TurnstileSecurityConfig): boolean =>
  hasValue(config?.siteKey);

export const assertTurnstileRuntimeContract = (config?: TurnstileSecurityConfig) => {
  if (!isTurnstileEnabled(config)) {
    return;
  }

  if (!hasValue(config?.secretKey)) {
    throw new AppError(500, "internal_error", "Missing TURNSTILE_SECRET_KEY runtime contract");
  }
};

const verifyTurnstileToken = async ({
  token,
  request,
  config,
  fetchImpl,
}: {
  token: string;
  request: Request;
  config: TurnstileSecurityConfig;
  fetchImpl: typeof fetch;
}) => {
  assertTurnstileRuntimeContract(config);

  const controller = new AbortController();
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = new URLSearchParams({
      secret: config.secretKey ?? "",
      response: token,
      remoteip: request.headers.get("cf-connecting-ip") ?? "",
    });

    const response = await fetchImpl(config.verifyUrl ?? DEFAULT_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });

    const result = (await response.json()) as TurnstileSiteverifyResponse;
    if (!response.ok || result.success !== true) {
      throw invalidRequestError();
    }
    if (hasValue(config.expectedHostname) && result.hostname !== config.expectedHostname) {
      throw invalidRequestError();
    }
    if (hasValue(config.action) && result.action !== config.action) {
      throw invalidRequestError();
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError(500, "internal_error", "Turnstile siteverify timed out");
    }
    throw new AppError(500, "internal_error", "Turnstile siteverify failed");
  } finally {
    clearTimeout(timeout);
  }
};

export const createTurnstileAbuseGuard = ({
  turnstile,
  fetchImpl = fetch,
}: {
  turnstile?: TurnstileSecurityConfig;
  fetchImpl?: typeof fetch;
}): MiddlewareHandler => {
  if (!isTurnstileEnabled(turnstile)) {
    return async (_c, next) => {
      await next();
    };
  }

  return async (c, next) => {
    const body = await c.req.raw.clone().formData();
    const token = body.get(TURNSTILE_TOKEN_FIELD);
    if (typeof token !== "string" || token.length === 0) {
      throw invalidRequestError();
    }

    await verifyTurnstileToken({
      token,
      request: c.req.raw,
      config: turnstile ?? {},
      fetchImpl,
    });

    await next();
  };
};
