---
type: guide
title: EdgeMatte release and deploy
status: draft
created: 2026-05-27
last_updated: 2026-05-30
---

# EdgeMatte release and deploy

This guide describes how EdgeMatte reaches production at
`https://edge-matte.ozby.dev`, who owns which infrastructure surface, and how a
maintainer bootstraps or verifies a release from a clean clone.

Architecture source of truth: [`docs/architecture.md`](./architecture.md).
Secret ownership: [`docs/secrets.md`](./secrets.md).
Infra bootstrap + chart: [`infra/README.md`](../infra/README.md).
Infrastructure deployment Mermaid chart:
[`docs/architecture.md#infrastructure-deployment-ownership`](./architecture.md#infrastructure-deployment-ownership).

## Ownership split

EdgeMatte follows the IngestLens boundary: **Pulumi owns durable Cloudflare
resources; Wrangler owns Worker-scoped deployment.**

| Surface                       | Owner                                                  | What it manages                                                       |
| ----------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| R2 bucket `edge-matte-images` | **Pulumi** (`infra/**`)                                | Bucket creation, lifecycle cleanup rules, optional CORS               |
| Worker runtime                | **Wrangler** (`apps/workers/wrangler.toml`)            | Worker script, `env.production` route, bindings, non-secret vars      |
| Static SPA shell              | **Wrangler** (`apps/workers/wrangler.toml` `[assets]`) | `apps/client/dist` served via `ASSETS` binding                        |
| R2 runtime binding            | **Wrangler**                                           | `IMAGES_BUCKET` → `edge-matte-images` (bucket must exist first)       |
| Images transform binding      | **Wrangler**                                           | `IMAGES` binding for horizontal flip via Cloudflare Images            |
| Deploy credentials            | **Doppler `ozby-shell`**                               | CI via `DOPPLER_SERVICE_TOKEN`; local via `with-secrets`              |
| Local/dev secret injection    | **Doppler (or selected manager)**                      | `wp config secrets set doppler ozby-shell`; never `.dev.vars` on disk |

Do not duplicate ownership: Pulumi must not deploy the Worker; Wrangler must not
create the R2 bucket.

Reusable provider-specific deploy plumbing stays on a separate
**private/internal** Cloudflare/Pulumi package boundary. Do not treat that
package as part of `agent-kit`, and do not treat reuse as automatic permission
to publish it. Any later public promotion must be planned separately and pass
`catalog/agent/rules/public-package-safety.md` expectations plus tarball and
denied-content review before release.

For the visual version of this split, see the Mermaid charts in
[`docs/architecture.md#infrastructure-deployment-ownership`](./architecture.md#infrastructure-deployment-ownership)
and [`infra/README.md#deployment-chart`](../infra/README.md#deployment-chart).

## Production target

| Item              | Value                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Public URL        | `https://edge-matte.ozby.dev`                                                                                                         |
| Worker name       | `edge-matte`                                                                                                                          |
| Wrangler env      | `production`                                                                                                                          |
| Shared lane ID    | `prd` (mapped to Wrangler env `production`)                                                                                           |
| Preview lanes     | `preview_main` -> `https://preview-main.edge-matte.ozby.dev`; `preview_pr_<n>` -> `https://preview-pr-<n>.edge-matte.ozby.dev`        |
| R2 bucket         | `edge-matte-images`                                                                                                                   |
| Health check      | `GET /health`                                                                                                                         |
| Confidence suites | `upload-delete-contract`, `smoke`, `upload-delete` (hermetic PR gate / local), `production-smoke`, `production-journey` (post-deploy) |

A deployment is **not healthy** until both `production-smoke` and
`production-journey` pass against the public URL.

## Shared deploy-contract adoption

EdgeMatte now adopts the shared deploy-contract surface on the canonical
`webpresso.config.ts` path while keeping local compatibility with
`agent-kit.config.ts`.

- Internal shared lane IDs stay `dev`, `preview_main`, `preview_pr_<n>`, `prd`
- Cloudflare-facing env names are derived separately and dash-safe
- `prd` maps to Wrangler env `production`
- the stable production Worker name remains `edge-matte`
- production release gating is driven by
  `infra/release-metadata.production.json`; `version_pr` metadata must include a
  semver `releaseVersion`
- `main` deploys to `preview_main`; pull requests deploy to
  `preview_pr_<n>` and closed pull requests destroy their preview Worker

Current EdgeMatte remains a **non-DO consumer**, so it does not declare Durable
Object bindings yet. Preview transport is declared as `custom_domain_env` for
the shared contract adoption surface, matching the IngestLens preview-lane
mechanism while preserving EdgeMatte's single-Worker runtime topology.

## Cloudflare Access private-beta contract

Cloudflare Access is the planned private-beta gate for
`https://edge-matte.ozby.dev`. Document the policy before enabling it so deploy
smoke, local operator checks, and production-only E2E do not regress.

### Policy matrix

| Surface                                                                     | Interactive browser policy                                                                                         | Automation / service-token policy                                                                                                                                              | Deny fallback                                                                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                                                                     | Allow only maintainers and approved beta users through the Cloudflare Access application for `edge-matte.ozby.dev` | Allow with `CF-Access-Client-Id` / `CF-Access-Client-Secret` headers sourced from `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` for deploy smoke and scripted verification | Any request without an allow rule or valid service-token headers is treated as denied; do not rely on bare `curl` once Access is on |
| `GET /health`                                                               | Same browser allow policy as `/`; useful for maintainers verifying the app interactively                           | Same service-token header contract as `/`; this is the canonical automation health probe                                                                                       | Same deny fallback as `/`                                                                                                           |
| `POST /api/jobs`, `GET /api/jobs/:id`, `DELETE /api/jobs/:id`, `GET /i/:id` | Same browser allow policy; the SPA, XHR, and hosted image route all stay behind the same Access boundary           | Production-only automation (for example `production-journey`) reuses the same service-token headers; no cookie jars or copied browser sessions on disk                         | Same deny fallback; do not carve out public bypasses for API/image paths                                                            |

### Operator rules

- **Browser allow rules**: keep the Access app scoped to `edge-matte.ozby.dev`
  and limit interactive access to maintainers plus the explicit beta allowlist.
- **Automation rules**: local `vp run deploy:production`, GitHub Actions
  post-deploy smoke, and any production-only E2E must source
  `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` from the secret manager,
  then send them as `CF-Access-Client-Id` / `CF-Access-Client-Secret`
  headers.
- **Secret storage**: Access service-token values follow the repo secret
  policy — values live in Doppler/Cloudflare only, never in `.env*`,
  `.dev.vars*`, or repo-tracked files.
- **Current workflow reality**: until the Access rollout is actually enabled,
  the existing bare `/health` smoke remains valid. At cutover, update the
  workflow/local smoke implementation and treat unauthenticated `/` + `/health`
  checks as intentionally unsupported.

### Break-glass rollback

Use this only when Access itself is blocking a legitimate deploy, smoke run, or
maintainer incident response:

1. In Cloudflare Zero Trust, disable the `edge-matte.ozby.dev` Access
   application **or** move a time-boxed break-glass bypass policy above the deny
   rule.
2. Re-run the blocked verification path (`GET /health`, `GET /`, or the
   production E2E suite) to restore operator access.
3. Finish the incident deploy / rollback work, then remove the bypass or
   re-enable the Access application immediately.
4. If the bypass scope was wider than intended, rotate
   `CF_ACCESS_CLIENT_SECRET`, confirm `CF_ACCESS_CLIENT_ID` still matches the
   active service token, and re-run post-deploy smoke.

## `/api/jobs` abuse-control posture

Private beta should treat `POST /api/jobs` as the only high-cost public action
inside the existing Worker topology. Keep the rest of the app behind the same
Cloudflare Access boundary, then apply route-specific abuse controls only to job
creation so smoke checks and normal polling do not trip false positives.

### Default posture

| Surface                                                   | Access                                                                                                     | Turnstile                                                                                                                                                                  | WAF / rate limit                                                                                                                                                                                                                                                                                                                | Operator notes                                                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `POST /api/jobs`                                          | Same Access allowlist + service-token contract as `/` and `/health`; never add a public bypass for uploads | Require `cf-turnstile-response` whenever `TURNSTILE_SITE_KEY` is enabled; reject missing, invalid, hostname-mismatch, action-mismatch, replayed, or timed-out verification | Start with a route-specific Cloudflare rule: **Managed Challenge above 10 `POST /api/jobs` requests per client IP per minute**. If one source keeps pushing after challenge or creates sustained cost pressure, escalate to a short-lived block rule at **30 requests per client IP per 10 minutes** while collecting evidence. | Keep thresholds narrow and private-beta-biased; tune only this route before touching broader site controls. |
| `GET /api/jobs/:id`, `DELETE /api/jobs/:id`, `GET /i/:id` | Same Access contract                                                                                       | No extra challenge beyond the upload-created token lifecycle                                                                                                               | No custom private-beta rate limit by default                                                                                                                                                                                                                                                                                    | These routes are part of the normal UX and production suites; observe first before adding custom limits.    |
| `GET /`, `GET /health`                                    | Same Access contract                                                                                       | None                                                                                                                                                                       | No custom abuse rule                                                                                                                                                                                                                                                                                                            | Smoke and manual verification must stay predictable; do not reuse upload thresholds here.                   |

### Tuning and rollback rules

- **Triage order:** check Access first, then Turnstile runtime health, then
  WAF/rate-limit rules. Roll back the narrowest layer that explains the
  symptom.
- **False positives on upload creation:** loosen or temporarily disable the
  `/api/jobs` rate-limit / WAF rule before disabling Access or removing
  Turnstile enforcement.
- **Turnstile runtime failures:** if the Worker returns `400 invalid_request`
  or `500 internal_error` for valid uploads, verify `TURNSTILE_SECRET_KEY`,
  `TURNSTILE_ACTION`, `TURNSTILE_EXPECTED_HOSTNAME`, and Siteverify reachability
  before relaxing edge protections.
- **Access failures:** if smoke, `/health`, or `/` fail because auth headers or
  the Access app are wrong, use the Access break-glass path above; do not mask
  an auth outage by weakening upload abuse controls.
- **Evidence first:** capture Cloudflare Security Events, Ray IDs, affected
  timestamps, sample responses, and whether `production-smoke` /
  `production-journey` were impacted before changing thresholds.

Use [`docs/runbooks/abuse-response.md`](./runbooks/abuse-response.md) for the
incident checklist, evidence requirements, and credential-rotation procedure.

## Maintainer bootstrap (clean clone)

Prerequisites:

- Node `>=24`, Bun (for e2e/scripts)
- Global `wp` and `vp` on `PATH` (`@webpresso/agent-kit` / vite-plus)
- Cloudflare account access (for one-time infra + secret setup)
- Secret manager configured for local commands (see [secrets](./secrets.md))

From a fresh checkout:

```bash
git clone <repo-url> edge-matte && cd edge-matte
vp install --frozen-lockfile

# Agent surfaces + policy (no secrets written to disk)
wp setup
wp config secrets show   # should report ozby-shell after vp install

# Quality gates (same surface CI uses)
vp run verify:secrets
wp audit absolute-path-policy --root .  # canonical shared audit surface
vp run audit:secret-provider-quarantine
vp run -r check-types
vp run -r lint
vp run test
vp run -r build

# Local journey verification
vp run e2e -- --suite smoke
vp run e2e -- --suite upload-delete

# Architecture + docs governance
wp audit docs-frontmatter
wp audit blueprint-lifecycle
wp audit architecture-drift --root .
wp audit guardrails
```

One-time platform setup (before first production deploy):

1. **Pulumi** — provision R2 bucket and lifecycle rules ([`infra/README.md`](../infra/README.md);
   blueprint `2026-05-27-edge-matte-infra-and-release`).
2. **GitHub Actions** — add `DOPPLER_SERVICE_TOKEN` scoped to `ozby-shell`
   (see [secrets](./secrets.md#github-actions-bootstrap)). Do not add raw
   `CLOUDFLARE_API_TOKEN` as GitHub repository secrets.
3. **Images binding** — ensure `IMAGES` is bound in production Wrangler config
   when IR-5 lands.

There are no hidden manual deploy steps beyond provider setup documented here
and in [`docs/secrets.md`](./secrets.md).

## Local deploy

Operator-local preview deploy:

```bash
wp deploy --lane preview_main
wp deploy --lane preview_pr_123
bun infra/src/deploy/deploy-preview.ts --lane preview-pr-123 --destroy
```

Preview deploys render a temporary Wrangler config outside the repo, deploy a
separate preview Worker name with `workers_dev = false`, attach the matching
custom-domain route (`preview-main.edge-matte.ozby.dev` or
`preview-pr-<n>.edge-matte.ozby.dev`), and never deploy `env.production`.

Operator-local production deploy (mirrors ingest-lens `deploy.ts` + Doppler):

```bash
vp run deploy:production
```

This builds the workspace, runs `with-secrets -- wrangler deploy --env production`
(loading `CLOUDFLARE_*` from `ozby-shell`), then verifies `/health` and runs
both post-deploy production suites: `production-smoke` and
`production-journey`.
Before deploy, it also runs `vp run verify:deploy-contract`, which verifies the
shared release metadata gate and confirms `env.production` / stable production
Worker naming remain intact.

Dry-run without mutating production (PR CI uses the same shape):

```bash
vp run --filter @edge-matte/worker build
vp exec --filter @edge-matte/worker -- wrangler deploy --dry-run --env production
```

## CI and release path

### Pull requests

Implemented across:

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- [`.github/workflows/architecture-drift.yml`](../.github/workflows/architecture-drift.yml)
- [`.github/workflows/deploy-preview.yml`](../.github/workflows/deploy-preview.yml)

Canonical PR contract:

1. **check** job — install, `verify:secrets`, shared path-policy audit,
   `audit:secret-provider-quarantine`, format, typecheck, lint, docs-frontmatter
2. **e2e** job — hermetic PR gate for `upload-delete-contract`, `smoke`, and
   `upload-delete` using local `wrangler dev` + `E2E_MOCK_PIPELINE:1`
3. **architecture-drift** job — dedicated architecture contract verification
4. **deploy-verify** job — preview-lane verification on pull requests plus
   preview deploy orchestration on `main` / manual runs

All workflow `uses:` references are intentionally pinned to full 40-character
commit SHAs, including GitHub-authored actions, so the repo can enforce
immutable-action policy without another migration.

PRs must not write production secrets or deploy to `edge-matte.ozby.dev`.

Workflow ownership is declared in [`.github/CODEOWNERS`](../.github/CODEOWNERS),
but Git alone cannot enforce that review. Maintainers must also enable GitHub
branch protection or rulesets with **Require review from Code Owners** for that
protection to become mandatory.

### Preview deploys

Implemented in [`.github/workflows/deploy-preview.yml`](../.github/workflows/deploy-preview.yml):

1. Pushes to `main` run quality gates and deploy `preview_main` as
   `edge-matte-preview-main` on `https://preview-main.edge-matte.ozby.dev`.
2. Pull requests run quality gates and deploy `preview_pr_<n>` as
   `edge-matte-preview-pr-<n>` on
   `https://preview-pr-<n>.edge-matte.ozby.dev`.
3. Closed pull requests call the preview destroy path for
   `edge-matte-preview-pr-<n>`.
4. Preview deploys use custom-domain preview transport and do not mutate the
   production route `edge-matte.ozby.dev`.

### Production release deploy

Implemented in [`.github/workflows/release.yml`](../.github/workflows/release.yml) with a manual fallback in [`.github/workflows/deploy-production.yml`](../.github/workflows/deploy-production.yml):

1. Feature branches merge a `.changeset/*.md` file to `main`; the shared Changesets release harness opens or updates the **Version Packages** PR automatically.
2. When the Version Packages PR merges, CI runs `pnpm run version` and `pnpm run release:publish`, then forwards the resolved `release_version` into the shared production deploy harness.
3. The production deploy path runs quality gates (`verify:secrets`, shared path-policy audit, `audit:secret-provider-quarantine`, format, lint, typecheck, build, test).
4. CI runs `pnpm run verify:deploy-contract` so production release metadata is present, contains a semver `releaseVersion`, and is valid before any deploy.
5. CI runs the same hermetic pre-deploy e2e gate used for PR confidence (`upload-delete-contract`, `smoke`, `upload-delete`).
6. Doppler injects `CLOUDFLARE_*` for the deploy job via `dopplerhq/secrets-fetch-action`.
7. The worker deploy still uses `wrangler deploy --env production`, but release orchestration no longer depends on a manually pushed `v*` tag.
8. **Serialize deploys** — concurrency group `edge-matte-production-deploy` (`cancel-in-progress: false`).
9. **Post-deploy production evidence** — after deploy succeeds:
   - `GET https://edge-matte.ozby.dev/health`
   - `GET https://edge-matte.ozby.dev/`
   - `E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-smoke`
   - `E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-journey`

Today those probes are bare requests. Once Cloudflare Access is enabled for
private beta, the same checks must send `CF-Access-Client-Id` /
`CF-Access-Client-Secret` from `CF_ACCESS_CLIENT_ID` /
`CF_ACCESS_CLIENT_SECRET` instead of falling back to unauthenticated curls.

If either post-deploy production suite fails, treat the release as unhealthy
and investigate before declaring success.

### Manual production verification

After any deploy (CI or emergency manual):

```bash
# Before Cloudflare Access rollout
curl -sf https://edge-matte.ozby.dev/health

# After Cloudflare Access rollout
curl -sf \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  https://edge-matte.ozby.dev/health
curl -sf \
  -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
  https://edge-matte.ozby.dev/
CF_ACCESS_CLIENT_ID="$CF_ACCESS_CLIENT_ID" \
CF_ACCESS_CLIENT_SECRET="$CF_ACCESS_CLIENT_SECRET" \
E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-smoke
CF_ACCESS_CLIENT_ID="$CF_ACCESS_CLIENT_ID" \
CF_ACCESS_CLIENT_SECRET="$CF_ACCESS_CLIENT_SECRET" \
E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-journey
```

Under Access, `/health` and `/` stay valid probes, but only through the
service-token headers documented above. Production-only E2E should reuse the
same env vars rather than copied cookies or manual browser sessions. Bare
requests should be treated as expected denials, not as evidence that production
is down.

## Release checklist

Use before merging infra/release changes or after cutover:

- [ ] Pulumi stack applied; R2 bucket `edge-matte-images` exists
- [ ] Wrangler production route targets `edge-matte.ozby.dev`
- [ ] Bindings present: `ASSETS`, `IMAGES_BUCKET`, `IMAGES`
- [ ] PR CI includes dry-run deploy
- [ ] PR CI includes hermetic e2e gate (`upload-delete-contract`, `smoke`, `upload-delete`)
- [ ] Cloudflare Access policy matrix is defined before private-beta cutover
- [ ] `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` are available to automation via Doppler, not repo files
- [ ] `/api/jobs` abuse-control posture and `docs/runbooks/abuse-response.md` are current before private-beta cutover
- [ ] `main` deploy uses concurrency serialization
- [ ] Workflow `uses:` references stay pinned to full SHAs
- [ ] GitHub branch protection / rulesets require Code Owner review for workflow changes
- [ ] Post-deploy verification runs both `production-smoke` and `production-journey` against the public URL
- [ ] No `.dev.vars*` / `.env*` files in repo (except documented `.env.example` if any)
- [ ] `wp audit architecture-drift --root .` passes

## Rollback

v1 rollback is redeploy of the last known-good Worker revision:

1. Identify last green commit on `main` (hermetic PR gate green and both `production-smoke` + `production-journey` green after deploy)
2. Re-run deploy workflow on that commit, or:
   `vp run deploy:production` from that checkout
3. Re-run post-deploy verification (`/health`, `/`, `production-smoke`, and `production-journey`)

R2 data is not rolled back with Worker deploys; job artifacts persist until
delete TTL or lifecycle rules apply.

## Related

- [`docs/architecture.md`](./architecture.md) — deployment ownership diagram
- [`infra/README.md`](../infra/README.md) — Pulumi bootstrap + infra deployment chart
- [`docs/secrets.md`](./secrets.md) — secret stores and bootstrap
- [`docs/runbooks/abuse-response.md`](./runbooks/abuse-response.md) — upload abuse triage, rollback, and credential rotation
- [`blueprints/archived/2026-05-27-edge-matte-infra-and-release.md`](../blueprints/archived/2026-05-27-edge-matte-infra-and-release.md) — implementation blueprint
