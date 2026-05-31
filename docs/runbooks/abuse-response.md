---
type: runbook
title: EdgeMatte abuse response
status: draft
created: 2026-05-30
last_updated: 2026-05-30
---

# Runbook: `/api/jobs` abuse response

- **When to use this runbook:** sustained upload spikes, unexpected 403/429/400
  responses on `POST /api/jobs`, unusual Worker/R2/images cost growth, or a
  private-beta incident where upload abuse controls may be blocking legitimate
  users.
- **Primary owner:** EdgeMatte maintainers operating production deploy and
  Cloudflare controls.
- **Expected runtime:** 30 min.

## Pre-flight

- [ ] Cloudflare dashboard access (Zero Trust, Security Events, WAF/rate
      limiting, Workers)
- [ ] Doppler `ozby-shell` access for credential rotation
- [ ] Production verification path ready (`/health`, `/`, `production-smoke`,
      `production-journey`)
- [ ] Incident channel and timeline doc identified

## Default private-beta posture

| Layer             | Expected state                                                                                                                                                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access            | `edge-matte.ozby.dev` stays behind the documented Cloudflare Access browser allowlist and service-token contract. No upload-specific public bypasses.                                                                                                                   |
| Turnstile         | `POST /api/jobs` requires `cf-turnstile-response` whenever `TURNSTILE_SITE_KEY` is enabled. The Worker rejects missing, invalid, replayed, hostname-mismatch, action-mismatch, and timed-out Siteverify results.                                                        |
| WAF / rate limit  | Route-specific control on `POST /api/jobs` only: start with **Managed Challenge above 10 requests per client IP per minute**; escalate to a short-lived **block above 30 requests per client IP per 10 minutes** only after evidence shows the challenge is not enough. |
| Non-upload routes | `/`, `/health`, `GET /api/jobs/:id`, `DELETE /api/jobs/:id`, and `GET /i/:id` keep the Access contract but do not inherit the upload-specific private-beta rate limit by default.                                                                                       |

## Evidence to collect before changing controls

Capture all of the following in the incident timeline before tuning rules:

- UTC timestamp range and affected route (`POST /api/jobs` vs `/health` or `/`)
- Sample HTTP status + response body (`400 invalid_request`, `500 internal_error`,
  Access denial, WAF challenge/block, or upstream timeout)
- Cloudflare Ray IDs and Security Events / rate-limiting event details
- Whether the problem reproduces with valid Access service-token headers
  (`CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`)
- Whether the problem reproduces with a fresh human Turnstile solve
- Whether `production-smoke` and `production-journey` still pass
- Approximate blast radius: one user/IP, one ASN/country, or broad maintainer / beta-user impact

## Triage order

1. **Check Access first.**
   - If `/health` or `/` is denied, or all browser traffic is locked out, this
     is an Access incident first.
   - Use the break-glass Access rollback in [`docs/release.md`](../release.md)
     if you need to restore maintainer verification quickly.
2. **Check Turnstile runtime second.**
   - `400 invalid_request` on valid uploads usually means a missing, expired,
     replayed, hostname-mismatch, or action-mismatch token.
   - `500 internal_error` means treat runtime configuration or Siteverify reachability
     as broken first: verify `TURNSTILE_SECRET_KEY`, `TURNSTILE_ACTION`,
     `TURNSTILE_EXPECTED_HOSTNAME`, and outbound Siteverify reachability.
3. **Check WAF / rate limiting third.**
   - If Access and Turnstile look healthy but only `POST /api/jobs` is being
     challenged or blocked, inspect the route-specific WAF / rate-limit rule.
   - Prefer tuning or disabling the narrow upload rule over weakening Access or
     removing Turnstile.

## Mitigation steps

1. Confirm the default posture above matches current production settings.
2. If one source is abusive but the default challenge is working, keep the
   challenge rule and monitor rather than escalating to a hard block.
3. If abuse is bypassing the challenge or causing clear cost pressure, add or
   tighten the temporary block rule for `POST /api/jobs` above **30 requests per
   client IP per 10 minutes**.
4. If legitimate users are blocked, roll back the narrowest WAF / rate-limit
   change first and re-test one upload flow before touching Access or Turnstile.
5. After every change, re-run:
   - `GET /health`
   - `GET /`
   - one real upload flow (or `production-journey` if safe to run)
   - `production-smoke`
   - `production-journey`
6. Record the exact Cloudflare rule change, who made it, and the timestamp in
   the incident timeline.

## Credential rotation

Rotate credentials only when exposure or misuse scope is plausible; do not write
new values to disk.

### Access automation credentials

Rotate when a broad Access bypass was used, service-token headers may have been
exposed, or an operator cannot prove the token stayed scoped.

1. Rotate the Cloudflare Access service token in Zero Trust.
2. Keep `CF_ACCESS_CLIENT_ID` aligned with the active token and replace
   `CF_ACCESS_CLIENT_SECRET` in Doppler `ozby-shell`.
3. Re-run `/health`, `/`, `production-smoke`, and `production-journey` with the
   new headers.

### Turnstile runtime credentials

Rotate when the Turnstile secret may have leaked or when you intentionally
replace the Turnstile widget contract.

1. Rotate the Turnstile secret in Cloudflare.
2. Update `TURNSTILE_SECRET_KEY` in the platform secret store.
3. If the widget contract changed, also confirm `TURNSTILE_SITE_KEY`,
   `TURNSTILE_ACTION`, and `TURNSTILE_EXPECTED_HOSTNAME` still match the live
   app.
4. Verify one upload end-to-end before declaring the incident closed.

## Rollback

If mitigations above worsen the incident:

1. Remove any temporary `POST /api/jobs` block rule.
2. Restore the default challenge-only posture.
3. Remove any temporary Access bypass after maintainer verification succeeds.
4. Re-run `/health`, `/`, `production-smoke`, and `production-journey`.

## Communication

Notify the maintainer responsible for deploy ownership and any active beta
support contact.

Suggested update:

> We are mitigating an upload-abuse incident on `POST /api/jobs`. Access status:
> <ok|degraded>. Turnstile status: <ok|degraded>. WAF/rate-limit action:
> <challenge tuned|temporary block added|rollback applied>. Verification:
> `<health>`, `<home>`, `production-smoke`, `production-journey` = <status>.
> Next update in <time>.

## Aftermath

- [ ] Update the incident timeline with evidence, rule changes, and verification results.
- [ ] File follow-up actions for any threshold or UX change that should become the new default.
- [ ] If this runbook was unclear, update it in the same PR as the postmortem.
