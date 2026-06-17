import assert from "node:assert/strict";
import { test } from "node:test";
import { probeWorkersServiceAuth } from "../infra/src/deploy/probe-cloudflare-workers-auth.ts";

test("probe rejects Cloudflare auth error (code 10000)", async () => {
  const result = await probeWorkersServiceAuth({
    accountId: "e93986039ea9bd9729fa534a29e9e88f",
    apiToken: "test-token",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ code: 10_000, message: "Authentication error" }],
        }),
        { status: 403 },
      ),
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "auth_error");
});

test("probe accepts missing worker when auth succeeds (code 10090)", async () => {
  const result = await probeWorkersServiceAuth({
    accountId: "b8dca46f0c151be797a4f15323f13eed",
    apiToken: "test-token",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ code: 10_090, message: "This Worker does not exist on this account." }],
        }),
        { status: 404 },
      ),
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, "service_missing_auth_ok");
});

test("probe accepts existing service", async () => {
  const result = await probeWorkersServiceAuth({
    accountId: "b8dca46f0c151be797a4f15323f13eed",
    apiToken: "test-token",
    fetchImpl: async () =>
      new Response(JSON.stringify({ success: true, result: { id: "edge-matte" } }), {
        status: 200,
      }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, "service_exists");
});
