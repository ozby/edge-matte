/**
 * Probes the same Cloudflare Workers Services API wrangler uses on deploy.
 * Dry-run alone can pass while real deploy fails (e.g. token scoped to a different account).
 */

const SERVICE_NAME = "edge-matte";
const AUTH_ERROR_CODE = 10_000;
const SERVICE_NOT_FOUND_CODE = 10_090;

export type WorkersAuthProbeResult =
  | { ok: true; reason: "service_exists" | "service_missing_auth_ok" }
  | { ok: false; reason: "missing_env" | "auth_error" | "unexpected_error"; detail: string };

export async function probeWorkersServiceAuth(input: {
  accountId: string;
  apiToken: string;
  serviceName?: string;
  fetchImpl?: typeof fetch;
}): Promise<WorkersAuthProbeResult> {
  const { accountId, apiToken, serviceName = SERVICE_NAME, fetchImpl = fetch } = input;

  if (!accountId.trim() || !apiToken.trim()) {
    return {
      ok: false,
      reason: "missing_env",
      detail: "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required",
    };
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/services/${serviceName}`;
  const response = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
  });

  let body: { success?: boolean; errors?: Array<{ code?: number; message?: string }> };
  try {
    body = (await response.json()) as typeof body;
  } catch {
    return {
      ok: false,
      reason: "unexpected_error",
      detail: `Workers Services API returned non-JSON (HTTP ${response.status})`,
    };
  }

  if (body.success === true) {
    return { ok: true, reason: "service_exists" };
  }

  const first = body.errors?.[0];
  const code = first?.code;
  const message = first?.message ?? "unknown error";

  if (code === AUTH_ERROR_CODE) {
    return {
      ok: false,
      reason: "auth_error",
      detail: [
        `Token cannot access account ${accountId} (HTTP ${response.status}: ${message}).`,
        "CLOUDFLARE_API_TOKEN must be created for the same Cloudflare account as CLOUDFLARE_ACCOUNT_ID.",
        "ozby-shell/prd currently pairs ozby account id e93986039… with a token scoped to a different account when misconfigured.",
        "Create an Account API token on the ozby account with Workers Scripts Edit + Workers Routes Edit, update Doppler, re-run deploy.",
      ].join(" "),
    };
  }

  if (code === SERVICE_NOT_FOUND_CODE) {
    return { ok: true, reason: "service_missing_auth_ok" };
  }

  return {
    ok: false,
    reason: "unexpected_error",
    detail: `Workers Services API error (HTTP ${response.status}, code ${code ?? "n/a"}): ${message}`,
  };
}

async function main(): Promise<void> {
  const result = await probeWorkersServiceAuth({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
    apiToken: process.env.CLOUDFLARE_API_TOKEN ?? "",
  });

  if (!result.ok) {
    console.error(`Cloudflare Workers auth probe failed (${result.reason}): ${result.detail}`);
    process.exit(1);
  }

  console.log(`OK: Workers Services API auth probe (${result.reason})`);
}

if (import.meta.main) {
  await main();
}
