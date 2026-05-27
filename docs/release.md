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

| Surface | Owner | What it manages |
| --- | --- | --- |
| R2 bucket `edge-matte-images` | **Pulumi** (`infra/**`) | Bucket creation, lifecycle cleanup rules, optional CORS |
| Worker runtime | **Wrangler** (`wrangler.toml`) | Worker script, `env.production` route, bindings, non-secret vars |
| Static SPA shell | **Wrangler** (`wrangler.toml` `[assets]`) | `apps/client/dist` served via `ASSETS` binding |
| R2 runtime binding | **Wrangler** | `IMAGES_BUCKET` → `edge-matte-images` (bucket must exist first) |
| Images transform binding | **Wrangler** | `IMAGES` binding for horizontal flip via Cloudflare Images |
| Provider secret names | **Wrangler** | Secret *names* declared in config; values never in repo |
| Provider secret values | **Cloudflare** | e.g. `PHOTOROOM_API_KEY` set with `wrangler secret put` |
| Deploy credentials | **GitHub + Cloudflare** | CI uses short-lived tokens from GitHub Secrets; see secrets doc |
| Local/dev secret injection | **Doppler (or selected manager)** | Via `wp config secrets set`; never `.dev.vars` / `.env` on disk |

Do not duplicate ownership: Pulumi must not deploy the Worker; Wrangler must not
create the R2 bucket.

## Production target

| Item | Value |
| --- | --- |
| Public URL | `https://edge-matte.ozby.dev` |
| Worker name | `edge-matte` |
| Wrangler env | `production` |
| R2 bucket | `edge-matte-images` |
| Health check | `GET /health` |
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
wp config secrets set doppler edge-matte   # or your team's manager

# Quality gates (same surface CI uses)
vp install
pnpm run verify:secrets
pnpm run audit:secret-provider-quarantine
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build

# Local journey verification
pnpm e2e -- --suite smoke
pnpm e2e -- --suite upload-delete

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
   wrangler secret put PHOTOROOM_API_KEY --env production
   ```

3. **GitHub Actions** — configure repository secrets for deploy only (see
   [secrets](./secrets.md#github-vs-cloudflare-vs-doppler)).
4. **Images binding** — ensure `IMAGES` is bound in production Wrangler config
   when IR-5 lands.

There are no hidden manual deploy steps beyond provider setup documented here
and in [`docs/secrets.md`](./secrets.md).

## Local deploy dry-run

PR CI and maintainers prove deployability without mutating production:

```bash
pnpm --filter @edge-matte/worker build
# equivalent: wrangler deploy --dry-run --env production
```

This validates Worker bundle, asset wiring, and production env config without
changing live traffic.

## CI and release path

### Pull requests

Target workflow shape (blueprint `IR-6`):

1. Install dependencies (`pnpm install --frozen-lockfile`)
2. Secret policy checks (`verify:secrets`, `audit:secret-provider-quarantine`)
3. Quality gates: format, lint, typecheck, test, build
4. Docs and blueprint audits
5. **Dry-run deploy** — `wrangler deploy --dry-run --env production`
6. E2E `smoke` suite (and optionally `upload-delete` on main-bound PRs)

PRs must not write production secrets or deploy to `edge-matte.ozby.dev`.

### `main` branch deploy

Target workflow shape (blueprint `IR-6`):

1. Run the same quality gates as PR CI
2. Deploy with `cloudflare/wrangler-action@v3`:

   ```yaml
   # illustrative — final workflow lives in .github/workflows/
   wrangler deploy --env production
   ```

3. **Serialize deploys** — use a GitHub Actions concurrency group so
   overlapping production deploys cannot run (e.g.
   `group: edge-matte-production-deploy`, `cancel-in-progress: false`).
4. **Post-deploy smoke** — after deploy succeeds:
   - `GET https://edge-matte.ozby.dev/health`
   - `GET https://edge-matte.ozby.dev/`
   - `E2E_RUN_PRODUCTION=1 pnpm e2e -- --suite production-smoke`

If post-deploy smoke fails, treat the release as unhealthy and investigate
before declaring success.

### Manual production verification

After any deploy (CI or emergency manual):

```bash
curl -sf https://edge-matte.ozby.dev/health
E2E_RUN_PRODUCTION=1 pnpm e2e -- --suite production-smoke
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
   `wrangler deploy --env production` from that checkout
3. Re-run post-deploy smoke

R2 data is not rolled back with Worker deploys; job artifacts persist until
delete TTL or lifecycle rules apply.

## Related

- [`docs/architecture.md`](./architecture.md) — deployment ownership diagram
- [`docs/secrets.md`](./secrets.md) — secret stores and bootstrap
- [`blueprints/completed/2026-05-27-edge-matte-infra-and-release.md`](../blueprints/completed/2026-05-27-edge-matte-infra-and-release.md) — implementation blueprint
