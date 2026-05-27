---
type: guide
title: EdgeMatte secrets
status: draft
created: 2026-05-27
last_updated: 2026-05-27
---

# EdgeMatte secrets

EdgeMatte never stores provider or deploy credential **values** in the repository.
Secret names, bootstrap paths, and ownership are documented here; values live in
Cloudflare or Doppler. GitHub Actions stores only the Doppler **bootstrap token**
(`DOPPLER_SERVICE_TOKEN`), not deploy or provider secret values.

Release context: [`docs/release.md`](./release.md).

## Forbidden on disk and in git

Secret **values** must never be written to repo files or committed to git.

Do not create or commit:

- `.dev.vars`, `.dev.vars.example`, or any `.dev.vars.*`
- `.env`, `.env.local`, or other `.env.*` files (except `.env.example` used only
  as non-secret onboarding documentation)
- `.webpresso/secrets.json` or any other `secrets.json` copied into the working
  tree (runtime selection belongs under `.git/webpresso/`, written by `wp`)
- `.wrangler/` local Wrangler state
- credential/key material such as `*.pem`, `*.p12`, or `credentials.json`

Enforcement:

| Check                                           | What it guards                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `scripts/verify-secrets-policy.ts`              | Working-tree secret carriers, tracked carriers, and secret-like values in git |
| `scripts/sync-webpresso-config.ts --check-only` | Committed wp default is metadata-only                                         |
| `pnpm run audit:secret-provider-quarantine`     | Direct provider CLI bypasses, dotenv imports, and secret downloads            |
| `pnpm run verify:paths`                         | Hardcoded relative repo traversal in scripts (CI + pre-commit)                |

Run secret gates with `pnpm run verify:secrets` and `pnpm run audit:secret-provider-quarantine`
(both in CI). Pre-commit also runs `wp audit absolute-path-policy --root .` and
`sync-webpresso-config.ts --check-only`.

## Two-project model (mirrors ingest-lens)

| Doppler project | Holds                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| `edge-matte`    | App-local secrets when populated (e.g. `PHOTOROOM_API_KEY` for dev)         |
| `ozby-shell`    | Shared infra credentials (`CLOUDFLARE_API_TOKEN`, `PULUMI_ACCESS_TOKEN`, …) |

**Repo default for deploy and Pulumi:** `.webpresso/secrets.config.json` points
at `ozby-shell` (committed **metadata only**). On `pnpm install`, the repo
applies that default through the canonical **`wp config secrets set`** surface
(seed-only — it does not overwrite an existing local selection). Command
execution still goes through **`with-secrets -- <cmd>`**, which reads the
runtime config `wp` persisted under `.git/webpresso/secrets.json`.

For **app-local dev keys** (e.g. testing `PHOTOROOM_API_KEY` locally), switch
the wp selection to Doppler project `edge-matte` once — deploy and CI still use
`ozby-shell` via the committed default:

```bash
wp config secrets set doppler edge-matte --label "edge-matte (app dev keys)"
```

```bash
pnpm run setup:secrets   # force re-apply after editing the committed default
wp config secrets show
with-secrets -- wrangler deploy --env production
```

### Security rules for the committed config

- Allowed keys: `manager`, `projectId`, `projectLabel` only — **no secret values**.
- Forbidden in git: tokens, passwords, API keys, or any Doppler secret values.
- Runtime wp selection (manager/project only, no values) lives under
  `.git/webpresso/secrets.json` (untracked, written by `wp`, never committed).
- CI validates metadata via `pnpm run verify:secrets`.

Production provider keys (`PHOTOROOM_API_KEY`) still live in **Cloudflare
Worker secrets**, not in GitHub or the app Doppler project.

## Where each credential lives

| Secret / credential     | Where the value lives                           | Who sets it                          | Used by                                   |
| ----------------------- | ----------------------------------------------- | ------------------------------------ | ----------------------------------------- |
| `PHOTOROOM_API_KEY`     | **Cloudflare Worker secret** (production)       | Maintainer via `wrangler secret put` | Worker at runtime                         |
| `CLOUDFLARE_API_TOKEN`  | **Doppler `ozby-shell`** (local + CI preferred) | Operator / shared infra project      | `with-secrets`, Pulumi, `wrangler deploy` |
| `CLOUDFLARE_ACCOUNT_ID` | **Doppler `ozby-shell`** or **Pulumi config**   | Operator                             | Pulumi preview/up, `wrangler deploy`      |
| Local dev provider keys | **Doppler** via `with-secrets`                  | Each developer                       | Local `wrangler dev`, tests, e2e          |

### Rules

1. **Provider keys never go to GitHub.** Photoroom and similar third-party API
   keys are Cloudflare Worker secrets in production and secret-manager injected
   locally — never repository or Actions secrets.
2. **Deploy capability comes from `ozby-shell`.** Same split as ingest-lens:
   infra credentials are shared across repos; EdgeMatte does not fork CF tokens
   into an app-only Doppler project.
3. **Wrangler declares names; Cloudflare holds values.** `wrangler.toml` and
   TypeScript `Env` types reference binding/secret names. Values are set with
   `wrangler secret put` or the Cloudflare dashboard.
4. **Local bootstrap uses committed defaults through wp.** Edit
   `.webpresso/secrets.config.json` (metadata only) in git. `pnpm install`
   runs `wp config secrets set` when no runtime selection exists; local overrides
   from an earlier `wp config secrets set` are preserved. Refresh after changing
   the committed default: `pnpm run setup:secrets`.

## Worker secrets and bindings

Production Worker runtime expects (names stable; values out-of-band):

| Name                | Kind           | Purpose                        |
| ------------------- | -------------- | ------------------------------ |
| `PHOTOROOM_API_KEY` | Secret         | Background removal provider    |
| `IMAGES_BUCKET`     | R2 binding     | Job metadata and image objects |
| `IMAGES`            | Images binding | Horizontal flip transform      |
| `ASSETS`            | Assets binding | SPA static shell               |

Non-secret vars (e.g. `APP_ORIGIN`) live in `wrangler.toml` `[vars]` /
`[env.production.vars]`.

### Set production provider secret

```bash
cd apps/worker
with-secrets -- wrangler secret put PHOTOROOM_API_KEY --env production
```

Verify the secret is present (name only — Wrangler does not print values):

```bash
wrangler secret list --env production
```

## GitHub Actions bootstrap

Deploy and dry-run CI inject credentials **only from Doppler** — secret values
never land in repo files. GitHub stores a single bootstrap token:

1. In Doppler, create a **service token** scoped to **`ozby-shell`** (config
   `prd` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`).
2. Add it as a GitHub repository secret: `DOPPLER_SERVICE_TOKEN` (or
   `DOPPLER_TOKEN`).

Workflows run `dopplerhq/secrets-fetch-action`, inject env vars for the job
only, then `wrangler deploy`. Do **not** add raw `CLOUDFLARE_API_TOKEN` or
`PHOTOROOM_API_KEY` as GitHub repository secrets.

The deploy workflow runs `scripts/verify-cloudflare-deploy-creds.sh` after
injection (`wrangler whoami` + `wrangler deploy --dry-run`) so auth/permission
failures surface before a real deploy.

### Required `CLOUDFLARE_API_TOKEN` permissions

The token in Doppler `ozby-shell` / `prd` must be able to **edit** the
`edge-matte` Worker on the account matching `CLOUDFLARE_ACCOUNT_ID`. Minimum
Cloudflare API token permissions:

- Account → Workers Scripts → **Edit**
- Account → Workers Routes → **Edit** (custom domain on `edge-matte.ozby.dev`)
- Account → Account Settings → **Read** (for `wrangler whoami`)

If deploy fails with `Authentication error [code: 10000]`, rotate the token in
the Cloudflare dashboard, update Doppler `ozby-shell`, and re-run **Deploy
production** (workflow supports `workflow_dispatch` on `main`).

## Local bootstrap

1. Install global Webpresso CLIs: `wp`, `vp`, and ensure `with-secrets` is on
   `PATH` (ships with `@webpresso/webpresso`).
2. Install dependencies (auto-syncs wp secrets config from
   `.webpresso/secrets.config.json`):

   ```bash
   pnpm install --frozen-lockfile
   wp config secrets show
   ```

3. Run policy checks:

   ```bash
   pnpm run verify:secrets
   pnpm run verify:paths
   pnpm run audit:secret-provider-quarantine
   ```

4. **Pulumi (R2 bucket)** — account ID can live in stack config instead of Doppler:

   ```bash
   cd infra
   pulumi stack init production   # once
   pulumi config set cloudflareAccountId "$CLOUDFLARE_ACCOUNT_ID" --secret
   with-secrets -- pulumi preview
   with-secrets -- pulumi up
   # or from repo root:
   pnpm run pulumi:up
   ```

5. **Production Worker deploy** (operator-local, same as ingest-lens deploy runbook):

   ```bash
   pnpm run deploy:production
   # or wrangler only:
   pnpm run deploy:production:wrangler
   ```

See [README.md](../README.md) for the full local verification surface and
[`docs/release.md`](./release.md) for maintainer bootstrap from a clean clone.

## Rotation

| Secret                 | Rotation path                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `PHOTOROOM_API_KEY`    | Update in Cloudflare (`with-secrets -- wrangler secret put …`), redeploy not required for secret-only updates; verify with smoke e2e |
| `CLOUDFLARE_API_TOKEN` | Rotate in Cloudflare dashboard, update `ozby-shell`, re-run deploy                                                                   |
| Doppler service token  | Rotate in Doppler dashboard, update `DOPPLER_SERVICE_TOKEN` in GitHub                                                                |

## Related

- [`docs/release.md`](./release.md) — deploy path and one-time platform setup
- [`docs/architecture.md`](./architecture.md) — deployment ownership boundary
- ingest-lens reference: `docs/secrets/doppler.md`, `docs/runbooks/dev-deploy.md`
