---
type: guide
title: EdgeMatte secrets
status: draft
created: 2026-05-27
last_updated: 2026-05-30
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
| `vp run audit:secret-provider-quarantine`       | Direct provider CLI bypasses, dotenv imports, and secret downloads            |
| `wp audit absolute-path-policy --root .`        | Canonical shared path-policy audit surface                                    |

Run secret gates with `vp run verify:secrets` and `vp run audit:secret-provider-quarantine`
(both in CI). Pre-commit also runs `wp audit absolute-path-policy --root .` and
`sync-webpresso-config.ts --check-only`.

## Two-project model (mirrors ingest-lens)

| Doppler project | Holds                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| `edge-matte`    | App-local secrets when populated                                            |
| `ozby-shell`    | Shared infra credentials (`CLOUDFLARE_API_TOKEN`, `PULUMI_ACCESS_TOKEN`, …) |

**Repo default for deploy and Pulumi:** `.webpresso/secrets.config.json` points
at `ozby-shell` (committed **metadata only**). On `vp install`, the repo
applies that default through the canonical **`wp config secrets set`** surface
(seed-only — it does not overwrite an existing local selection). Command
execution still goes through **`with-secrets -- <cmd>`**, which reads the
runtime config `wp` persisted under `.git/webpresso/secrets.json`.

### Security rules for the committed config

- Allowed keys: `manager`, `projectId`, `projectLabel` only — **no secret values**.
- Forbidden in git: tokens, passwords, API keys, or any Doppler secret values.
- Runtime wp selection (manager/project only, no values) lives under
  `.git/webpresso/secrets.json` (untracked, written by `wp`, never committed).
- CI validates metadata via `vp run verify:secrets`.

## Where each credential lives

| Secret / credential     | Where the value lives                           | Who sets it                     | Used by                                   |
| ----------------------- | ----------------------------------------------- | ------------------------------- | ----------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | **Doppler `ozby-shell`** (local + CI preferred) | Operator / shared infra project | `with-secrets`, Pulumi, `wrangler deploy` |
| `CLOUDFLARE_ACCOUNT_ID` | **Doppler `ozby-shell`** or **Pulumi config**   | Operator                        | Pulumi preview/up, `wrangler deploy`      |

### Rules

1. **Deploy capability comes from `ozby-shell`.** Infra credentials are shared across repos; EdgeMatte does not fork CF tokens into an app-only Doppler project. No per-app Worker secrets required.
2. **Wrangler declares names; Cloudflare holds values.** `wrangler.toml` and
   TypeScript `Env` types reference binding/secret names. Values are set with
   `wrangler secret put` or the Cloudflare dashboard.
3. **Local bootstrap uses committed defaults through wp.** Edit
   `.webpresso/secrets.config.json` (metadata only) in git. `vp install`
   runs `wp config secrets set` when no runtime selection exists; local overrides
   from an earlier `wp config secrets set` are preserved. Refresh after changing
   the committed default: `vp run setup:secrets`.

## Worker secrets and bindings

Production Worker runtime expects (names stable; values out-of-band):

| Name            | Kind           | Purpose                                             |
| --------------- | -------------- | --------------------------------------------------- |
| `IMAGES_BUCKET` | R2 binding     | Job metadata and image objects                      |
| `IMAGES`        | Images binding | Background removal (`segment: "foreground"`) + flip |
| `ASSETS`        | Assets binding | SPA static shell                                    |

No Worker secrets required. Background removal uses the `IMAGES` binding (Cloudflare-native BiRefNet). Non-secret vars (e.g. `APP_ORIGIN`) live in `wrangler.toml` `[vars]` / `[env.production.vars]`.

## GitHub Actions bootstrap

Deploy and dry-run CI inject credentials **only from Doppler** — secret values
never land in repo files. GitHub stores a single bootstrap token:

1. In Doppler, create a **service token** scoped to **`ozby-shell`** (config
   `prd` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`).
2. Add it as a GitHub repository secret: `DOPPLER_SERVICE_TOKEN` (or
   `DOPPLER_TOKEN`).

Workflows run `dopplerhq/secrets-fetch-action`, inject env vars for the job
only, then `wrangler deploy`. Do **not** add raw `CLOUDFLARE_API_TOKEN` as a GitHub repository secret.

The workflow files that consume this action are intentionally pinned to full
40-character commit SHAs, and workflow-path review ownership lives in
[`.github/CODEOWNERS`](../.github/CODEOWNERS). To make that ownership
mandatory, maintainers must enable GitHub branch protection or rulesets with
**Require review from Code Owners**.

The deploy workflow runs `scripts/verify-cloudflare-deploy-creds.sh` after
injection:

1. `wrangler whoami` — shows which account(s) the token can access
2. **Workers Services API probe** — same `/workers/services/edge-matte` path
   `wrangler deploy` uses (dry-run alone is not sufficient)
3. `wrangler deploy --dry-run` — bundle validation only

### Required `CLOUDFLARE_API_TOKEN` permissions

`CLOUDFLARE_ACCOUNT_ID` in Doppler must be the **ozby** Cloudflare account
(`e93986039ea9bd9729fa534a29e9e88f`, same as ingest-lens). The API token must
be created **on that same account**, not on a different account (e.g. a
Webpresso org token paired with the ozby account id will pass `whoami` and
dry-run but fail deploy with `Authentication error [code: 10000]`).

Minimum token permissions on the **ozby** account:

- Account → Workers Scripts → **Edit**
- Account → Workers Routes → **Edit** (custom domain on `edge-matte.ozby.dev`)
- Account → Account Settings → **Read** (for `wrangler whoami`)

**Fix checklist** when deploy fails with code `10000`:

1. Cloudflare dashboard → **ozby** account → API Tokens → create token with the
   permissions above (or use the same token that already deploys ingest-lens).
2. `doppler secrets set CLOUDFLARE_API_TOKEN --project ozby-shell --config prd`
3. Confirm `CLOUDFLARE_ACCOUNT_ID` stays `e93986039ea9bd9729fa534a29e9e88f`.
4. Locally: `with-secrets -- bash scripts/verify-cloudflare-deploy-creds.sh`
5. Re-run **Deploy production** (`workflow_dispatch` on `main` is fine).

## Local bootstrap

1. Install global Webpresso CLIs: `wp`, `vp`, and ensure `with-secrets` is on
   `PATH` (ships with `@webpresso/webpresso`).
2. Install dependencies (auto-syncs wp secrets config from
   `.webpresso/secrets.config.json`):

   ```bash
   vp install --frozen-lockfile
   wp config secrets show
   ```

3. Run policy checks:

   ```bash
   vp run verify:secrets
   wp audit absolute-path-policy --root .
   vp run audit:secret-provider-quarantine
   ```

4. **Pulumi (R2 bucket)** — account ID can live in stack config instead of Doppler:

   ```bash
   cd infra
   pulumi stack init production   # once
   pulumi config set cloudflareAccountId "$CLOUDFLARE_ACCOUNT_ID" --secret
   with-secrets -- pulumi preview
   with-secrets -- pulumi up
   # or from repo root:
   vp run pulumi:up
   ```

5. **Production Worker deploy** (operator-local, same as ingest-lens deploy runbook):

   ```bash
   vp run deploy:production
   # or wrangler only:
   vp run deploy:production:wrangler
   ```

See [README.md](../README.md) for the full local verification surface and
[`docs/release.md`](./release.md) for maintainer bootstrap from a clean clone.

## Rotation

| Secret                 | Rotation path                                                         |
| ---------------------- | --------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN` | Rotate in Cloudflare dashboard, update `ozby-shell`, re-run deploy    |
| Doppler service token  | Rotate in Doppler dashboard, update `DOPPLER_SERVICE_TOKEN` in GitHub |

## Related

- [`docs/release.md`](./release.md) — deploy path and one-time platform setup
- [`docs/architecture.md`](./architecture.md) — deployment ownership boundary
- ingest-lens reference: `docs/secrets/doppler.md`, `docs/runbooks/dev-deploy.md`
