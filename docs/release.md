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

| Surface                       | Owner                                     | What it manages                                                       |
| ----------------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| R2 bucket `edge-matte-images` | **Pulumi** (`infra/**`)                   | Bucket creation, lifecycle cleanup rules, optional CORS               |
| Worker runtime                | **Wrangler** (`wrangler.toml`)            | Worker script, `env.production` route, bindings, non-secret vars      |
| Static SPA shell              | **Wrangler** (`wrangler.toml` `[assets]`) | `apps/client/dist` served via `ASSETS` binding                        |
| R2 runtime binding            | **Wrangler**                              | `IMAGES_BUCKET` → `edge-matte-images` (bucket must exist first)       |
| Images transform binding      | **Wrangler**                              | `IMAGES` binding for horizontal flip via Cloudflare Images            |
| Deploy credentials            | **Doppler `ozby-shell`**                  | CI via `DOPPLER_SERVICE_TOKEN`; local via `with-secrets`              |
| Local/dev secret injection    | **Doppler (or selected manager)**         | `wp config secrets set doppler ozby-shell`; never `.dev.vars` on disk |

Do not duplicate ownership: Pulumi must not deploy the Worker; Wrangler must not
create the R2 bucket.

For the visual version of this split, see the Mermaid charts in
[`docs/architecture.md#infrastructure-deployment-ownership`](./architecture.md#infrastructure-deployment-ownership)
and [`infra/README.md#deployment-chart`](../infra/README.md#deployment-chart).

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

- Node `>=24`, Bun (for e2e/scripts)
- Global `wp` and `vp` on `PATH` (`@webpresso/agent-kit` / vite-plus)
- Cloudflare account access (for one-time infra + secret setup)
- Secret manager configured for local commands (see [secrets](./secrets.md))

From a fresh checkout:

```bash
git clone <repo-url> edge-matte && cd edge-matte
vp install --frozen-lockfile

# Agent surfaces + policy (no secrets written to disk)
wp setup --yes
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
wp audit blueprint-lifecycle --legacy-omx
wp audit architecture-drift --root .
WP_SKIP_UPDATE_CHECK=1 wp audit guardrails
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

Operator-local production deploy (mirrors ingest-lens `deploy.ts` + Doppler):

```bash
vp run deploy:production
```

This builds the workspace, runs `with-secrets -- wrangler deploy --env production`
(loading `CLOUDFLARE_*` from `ozby-shell`), then curls `/health` and runs
`production-smoke` e2e.

Wrangler-only (no smoke):

```bash
vp run deploy:production:wrangler
```

Dry-run without mutating production (PR CI uses the same shape):

```bash
vp run --filter @edge-matte/worker build
vp exec --filter @edge-matte/worker -- wrangler deploy --dry-run --env production
```

## CI and release path

### Pull requests

Implemented in [`.github/workflows/ci.webpresso.yml`](../.github/workflows/ci.webpresso.yml):

1. **check** job — install, `verify:secrets`, shared path-policy audit,
   `audit:secret-provider-quarantine`, format, typecheck, lint, docs/blueprint audits
2. **test** job — `vp run test`
3. **e2e** job — hermetic PR gate for `upload-delete-contract`, `smoke`, and
   `upload-delete` using local `wrangler dev` + `E2E_MOCK_PIPELINE:1`
4. **mutation** job — affected-only mutation run on pull requests
5. **deploy-verify** job — build, Doppler-injected credentials, `wrangler deploy --dry-run --env production`

All workflow `uses:` references are intentionally pinned to full 40-character
commit SHAs, including GitHub-authored actions, so the repo can enforce
immutable-action policy without another migration.

PRs must not write production secrets or deploy to `edge-matte.ozby.dev`.

Workflow ownership is declared in [`.github/CODEOWNERS`](../.github/CODEOWNERS),
but Git alone cannot enforce that review. Maintainers must also enable GitHub
branch protection or rulesets with **Require review from Code Owners** for that
protection to become mandatory.

### `main` branch deploy

Implemented in [`.github/workflows/deploy.production.yml`](../.github/workflows/deploy.production.yml):

1. Run quality gates (`verify:secrets`, shared path-policy audit, `audit:secret-provider-quarantine`, format, lint, typecheck, build, test)
2. Run the same hermetic pre-deploy e2e gate used for PR confidence (`upload-delete-contract`, `smoke`, `upload-delete`)
3. Inject `CLOUDFLARE_*` from Doppler via `dopplerhq/secrets-fetch-action`
4. Deploy with `vp exec --filter @edge-matte/worker -- wrangler deploy --env production`
5. **Serialize deploys** — concurrency group `edge-matte-production-deploy`
   (`cancel-in-progress: false`)
6. **Post-deploy smoke** — after deploy succeeds:
   - `GET https://edge-matte.ozby.dev/health`
   - `GET https://edge-matte.ozby.dev/`
   - `E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-smoke`

If post-deploy smoke fails, treat the release as unhealthy and investigate
before declaring success.

### Manual production verification

After any deploy (CI or emergency manual):

```bash
curl -sf https://edge-matte.ozby.dev/health
E2E_RUN_PRODUCTION=1 vp run e2e -- --suite production-smoke
```

## Release checklist

Use before merging infra/release changes or after cutover:

- [ ] Pulumi stack applied; R2 bucket `edge-matte-images` exists
- [ ] Wrangler production route targets `edge-matte.ozby.dev`
- [ ] Bindings present: `ASSETS`, `IMAGES_BUCKET`, `IMAGES`
- [ ] PR CI includes dry-run deploy
- [ ] PR CI includes hermetic e2e gate (`upload-delete-contract`, `smoke`, `upload-delete`)
- [ ] `main` deploy uses concurrency serialization
- [ ] Workflow `uses:` references stay pinned to full SHAs
- [ ] GitHub branch protection / rulesets require Code Owner review for workflow changes
- [ ] Post-deploy smoke runs `production-smoke` against public URL
- [ ] No `.dev.vars*` / `.env*` files in repo (except documented `.env.example` if any)
- [ ] `wp audit architecture-drift --root .` passes

## Rollback

v1 rollback is redeploy of the last known-good Worker revision:

1. Identify last green commit on `main` (CI + `production-smoke` green)
2. Re-run deploy workflow on that commit, or:
   `vp run deploy:production` from that checkout
3. Re-run post-deploy smoke

R2 data is not rolled back with Worker deploys; job artifacts persist until
delete TTL or lifecycle rules apply.

## Related

- [`docs/architecture.md`](./architecture.md) — deployment ownership diagram
- [`infra/README.md`](../infra/README.md) — Pulumi bootstrap + infra deployment chart
- [`docs/secrets.md`](./secrets.md) — secret stores and bootstrap
- [`blueprints/completed/2026-05-27-edge-matte-infra-and-release.md`](../blueprints/completed/2026-05-27-edge-matte-infra-and-release.md) — implementation blueprint
