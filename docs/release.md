---
type: guide
title: EdgeMatte release and deploy
status: draft
created: 2026-05-27
last_updated: 2026-05-27
---

# EdgeMatte release and deploy

This guide describes how EdgeMatte reaches production at
`https://edge-matte.ozby.dev`, who owns which infrastructure surface, and how a
maintainer bootstraps or verifies a release from a clean clone.

Architecture source of truth: [`docs/architecture.md`](./architecture.md).
Secret ownership: [`docs/secrets.md`](./secrets.md).

## Ownership split

EdgeMatte follows the IngestLens boundary: **Pulumi owns durable Cloudflare
resources; Wrangler owns Worker-scoped deployment.**

| Surface                       | Owner                                     | What it manages                                                       |
| ----------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| R2 bucket `edge-matte-images` | **Pulumi** (`infra/**`)                   | Bucket creation, lifecycle cleanup rules, optional CORS               |
| Worker runtime                | **Wrangler** (`wrangler.toml`)            | Worker script, `env.production` route, bindings, non-secret vars      |
| Static SPA shell              | **Wrangler** (`wrangler.toml` `[assets]`) | `apps/client/dist` served via `ASSETS` binding                        |
| R2 runtime binding            | **Wrangler**                              | `IMAGES_BUCKET` → `edge-matte-images` (bucket must exist first)       |
| Images transform binding      | **Wrangler**                              | `IMAGES` binding for horizontal flip via Cloudflare Images            |
| Provider secret names         | **Wrangler**                              | Secret _names_ declared in config; values never in repo               |
| Provider secret values        | **Cloudflare**                            | e.g. `PHOTOROOM_API_KEY` set with `wrangler secret put`               |
| Deploy credentials            | **Doppler `ozby-shell`**                  | CI via `DOPPLER_SERVICE_TOKEN`; local via `with-secrets`              |
| Local/dev secret injection    | **Doppler (or selected manager)**         | `wp config secrets set doppler ozby-shell`; never `.dev.vars` on disk |

Do not duplicate ownership: Pulumi must not deploy the Worker; Wrangler must not
create the R2 bucket.

## Production target

| Item         | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| Public URL   | `https://edge-matte.ozby.dev`                                         |
| Worker name  | `edge-matte`                                                          |
| Wrangler env | `production`                                                          |
| R2 bucket    | `edge-matte-images`                                                   |
| Health check | `GET /health`                                                         |
| Smoke suites | `smoke`, `upload-delete` (CI/local), `production-smoke` (post-deploy) |

A deployment is **not healthy** until `production-smoke` passes against the
public URL.

## Maintainer bootstrap (clean clone)

Prerequisites:

- Node `>=24`, pnpm `11.x`, Bun (for e2e/scripts)
- Global `wp` and `vp` on `PATH` (`@webpresso/agent-kit` / vite-plus)
- Cloudflare account access (for one-time infra + secret setup)
- Secret manager configured for local commands (see [secrets](./secrets.md))

From a fresh checkout:

```bash
git clone <repo-url> edge-matte && cd edge-matte
pnpm install --frozen-lockfile

# Agent surfaces + policy (no secrets written to disk)
wp setup --yes
wp config secrets show   # should report ozby-shell after pnpm install

# Quality gates (same surface CI uses)
vp install
pnpm run verify:secrets
pnpm run verify:paths   # wraps: wp audit absolute-path-policy --root .
pnpm run audit:secret-provider-quarantine
vp run -r check-types
vp run -r lint
pnpm run test
vp run -r build

# Local journey verification
pnpm run e2e -- --suite smoke
pnpm run e2e -- --suite upload-delete

# Architecture + docs governance
pnpm run docs:check
pnpm run blueprints:check
python3 scripts/check_architecture_drift.py
WP_SKIP_UPDATE_CHECK=1 wp audit guardrails
```

One-time platform setup (before first production deploy):

1. **Pulumi** — provision R2 bucket and lifecycle rules ([`infra/README.md`](../infra/README.md);
   blueprint `2026-05-27-edge-matte-infra-and-release`).
2. **Cloudflare Worker secrets** — set provider values in Cloudflare, not GitHub:

   ```bash
   cd apps/worker
   with-secrets -- wrangler secret put PHOTOROOM_API_KEY --env production
   ```

3. **GitHub Actions** — add `DOPPLER_SERVICE_TOKEN` scoped to `ozby-shell`
   (see [secrets](./secrets.md#github-actions-bootstrap)). Do not add raw
   `CLOUDFLARE_API_TOKEN` or `PHOTOROOM_API_KEY` as GitHub repository secrets.
4. **Images binding** — ensure `IMAGES` is bound in production Wrangler config
   when IR-5 lands.

There are no hidden manual deploy steps beyond provider setup documented here
and in [`docs/secrets.md`](./secrets.md).

## Local deploy

Operator-local production deploy (mirrors ingest-lens `deploy.ts` + Doppler):

```bash
pnpm run deploy:production
```

This builds the workspace, runs `with-secrets -- wrangler deploy --env production`
(loading `CLOUDFLARE_*` from `ozby-shell`), then curls `/health` and runs
`production-smoke` e2e.

Wrangler-only (no smoke):

```bash
pnpm run deploy:production:wrangler
```

Dry-run without mutating production (PR CI uses the same shape):

```bash
pnpm --filter @edge-matte/worker build
pnpm --filter @edge-matte/worker exec wrangler deploy --dry-run --env production
```

## CI and release path

### Pull requests

Implemented in [`.github/workflows/ci.webpresso.yml`](../.github/workflows/ci.webpresso.yml):

1. **check** job — install, `verify:secrets`, `verify:paths`,
   `audit:secret-provider-quarantine`, format, typecheck, lint, docs/blueprint audits
2. **test** job — `pnpm run test`
3. **deploy-verify** job — build, Doppler-injected credentials, `wrangler deploy --dry-run --env production`

E2E (`smoke`, `upload-delete`) runs locally or in maintainer bootstrap — not in PR CI yet.

PRs must not write production secrets or deploy to `edge-matte.ozby.dev`.

### `main` branch deploy

Implemented in [`.github/workflows/deploy.production.yml`](../.github/workflows/deploy.production.yml):

1. Run quality gates (`verify:secrets`, `verify:paths`, `audit:secret-provider-quarantine`, format, lint, typecheck, build, test)
2. Inject `CLOUDFLARE_*` from Doppler via `dopplerhq/secrets-fetch-action`
3. Deploy with `pnpm --filter @edge-matte/worker exec wrangler deploy --env production`
4. **Serialize deploys** — concurrency group `edge-matte-production-deploy`
   (`cancel-in-progress: false`)
5. **Post-deploy smoke** — after deploy succeeds:
   - `GET https://edge-matte.ozby.dev/health`
   - `GET https://edge-matte.ozby.dev/`
   - `E2E_RUN_PRODUCTION=1 pnpm run e2e -- --suite production-smoke`

If post-deploy smoke fails, treat the release as unhealthy and investigate
before declaring success.

### Manual production verification

After any deploy (CI or emergency manual):

```bash
curl -sf https://edge-matte.ozby.dev/health
E2E_RUN_PRODUCTION=1 pnpm run e2e -- --suite production-smoke
```

## Release checklist

Use before merging infra/release changes or after cutover:

- [ ] Pulumi stack applied; R2 bucket `edge-matte-images` exists
- [ ] Wrangler production route targets `edge-matte.ozby.dev`
- [ ] Bindings present: `ASSETS`, `IMAGES_BUCKET`, `IMAGES`
- [ ] `PHOTOROOM_API_KEY` set in Cloudflare (not GitHub)
- [ ] PR CI includes dry-run deploy
- [ ] `main` deploy uses concurrency serialization
- [ ] Post-deploy smoke runs `production-smoke` against public URL
- [ ] No `.dev.vars*` / `.env*` files in repo (except documented `.env.example` if any)
- [ ] `python3 scripts/check_architecture_drift.py` passes

## Rollback

v1 rollback is redeploy of the last known-good Worker revision:

1. Identify last green commit on `main` (CI + `production-smoke` green)
2. Re-run deploy workflow on that commit, or:
   `pnpm run deploy:production` from that checkout
3. Re-run post-deploy smoke

R2 data is not rolled back with Worker deploys; job artifacts persist until
delete TTL or lifecycle rules apply.

## Related

- [`docs/architecture.md`](./architecture.md) — deployment ownership diagram
- [`docs/secrets.md`](./secrets.md) — secret stores and bootstrap
- [`blueprints/completed/2026-05-27-edge-matte-infra-and-release.md`](../blueprints/completed/2026-05-27-edge-matte-infra-and-release.md) — implementation blueprint
