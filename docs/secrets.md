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
Cloudflare or the configured secret provider. GitHub Actions stores only the shared reusable-workflow token mappings plus repo-owned secret profiles, not deploy or provider secret values.

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

| Check                                     | What it guards                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `scripts/verify-secrets-policy.ts`        | Working-tree secret carriers, tracked carriers, and secret-like values in git |
| `wp audit secrets-config`                 | Committed wp default is metadata-only                                         |
| `vp run audit:secret-provider-quarantine` | Direct provider CLI bypasses, dotenv imports, and secret downloads            |
| `wp audit absolute-path-policy --root .`  | Canonical shared path-policy audit surface                                    |

Run secret gates with `vp run verify:secrets` and `vp run audit:secret-provider-quarantine`
(both in CI). Pre-commit also runs `wp audit absolute-path-policy --root .` and
`wp audit secrets-config`.

## Two-project model (mirrors ingest-lens)

| Secret-provider project | Holds                                                                       |
| ----------------------- | --------------------------------------------------------------------------- |
| App-local selection     | App-local secrets when populated                                            |
| Shared infra selection  | Shared infra credentials (`CLOUDFLARE_API_TOKEN`, `PULUMI_ACCESS_TOKEN`, …) |

**Repo default for deploy and Pulumi:** `.webpresso/secrets.config.json` points at the per-app `edge-matte` project inside the separate ozby Doppler workplace (committed **metadata only**). On `vp install`, the repo
applies that default through the canonical **`wp config secrets set`** surface
(seed-only — it does not overwrite an existing local selection). Command
execution now goes through shared `wp` secret surfaces such as
**`wp secrets run --sink <sink> --profile <profile> -- <cmd>`** and `wp deploy`.

### Security rules for the committed config

- Allowed top-level shape: `schemaVersion`, `providers`, `profiles`, and `sinks`
  only — **no secret values**.
- Forbidden in git: tokens, passwords, API keys, or any secret-provider-managed secret values.
- Runtime wp selection (manager/project only, no values) lives under
  `.git/webpresso/secrets.json` (untracked, written by `wp`, never committed).
- CI validates metadata via `vp run verify:secrets`.

## Where each credential lives

| Secret / credential       | Where the value lives                                         | Who sets it                     | Used by                                                                                        |
| ------------------------- | ------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`    | **Configured secret-provider selection**                      | Operator / shared infra project | `wp secrets run`, Pulumi, `wrangler deploy`                                                    |
| `CLOUDFLARE_ACCOUNT_ID`   | **Configured secret-provider selection** or **Pulumi config** | Operator                        | Pulumi preview/up, `wrangler deploy`                                                           |
| `CF_ACCESS_CLIENT_ID`     | **Configured secret-provider selection**                      | Operator / Zero Trust owner     | Sent as `CF-Access-Client-Id` for Access-protected `/health`, `/`, API, and image verification |
| `CF_ACCESS_CLIENT_SECRET` | **Configured secret-provider selection**                      | Operator / Zero Trust owner     | Sent as `CF-Access-Client-Secret` for the same Access automation flows                         |

### Rules

1. **Deploy capability comes from the shared secret-provider selection.** Infra credentials are shared across repos; EdgeMatte does not fork CF tokens into an app-only provider namespace.
2. **Access automation also comes from the shared secret-provider selection.** Store
   `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` beside the deploy
   credentials, then inject them into local deploy smoke, GitHub Actions, and
   production-only E2E as headers — never as cookies or checked-in files.
3. **Wrangler declares names; Cloudflare holds values.** `apps/workers/wrangler.toml` and
   TypeScript `Env` types reference binding names and non-secret vars. Secret
   values are not part of the current runtime contract.
4. **Local bootstrap uses committed defaults through wp.** Edit
   `.webpresso/secrets.config.json` (metadata only) in git. Diagnose and verify
   it with `wp secrets doctor --profile preview --json`.
5. **Reusable Cloudflare/Pulumi deploy helpers stay private by default.** If a
   separate infra helper package is introduced for sync/render/deploy plumbing,
   keep it private/internal unless a later package-surface blueprint explicitly
   promotes it. Any such promotion must pass
   `catalog/agent/rules/public-package-safety.md` expectations plus tarball and
   denied-content review; reusability alone is not a publishing justification.

## Cloudflare Access automation secrets

These values are for the Cloudflare Access **service token** that authenticates
non-browser verification against `edge-matte.ozby.dev` during private beta.
They are not Worker bindings and must never be committed.

| Name                      | Owner                       | Where the value lives                | Consumed by                                                                                            |
| ------------------------- | --------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `CF_ACCESS_CLIENT_ID`     | Cloudflare Zero Trust owner | Configured secret-provider selection | `vp run deploy:production`, GitHub Actions post-deploy smoke, `production-smoke`, `production-journey` |
| `CF_ACCESS_CLIENT_SECRET` | Cloudflare Zero Trust owner | Configured secret-provider selection | Same flows; sent only as `CF-Access-Client-Secret` at runtime                                          |

Rules:

- Send these values only as `CF-Access-Client-Id` /
  `CF-Access-Client-Secret` headers.
- Do not copy Access cookies or browser session artifacts into the repo or CI.
- Keep the Access application policy aligned with the release guide’s matrix:
  browser allowlist + service-token automation + deny fallback.
- If break-glass bypass is used during an incident, rotate
  `CF_ACCESS_CLIENT_SECRET` afterward if exposure scope is uncertain.

## Worker secrets and bindings

Production Worker runtime expects (names stable; values out-of-band):

| Name            | Kind           | Purpose                                             |
| --------------- | -------------- | --------------------------------------------------- |
| `IMAGES_BUCKET` | R2 binding     | Job metadata and image objects                      |
| `IMAGES`        | Images binding | Background removal (`segment: "foreground"`) + flip |
| `ASSETS`        | Assets binding | SPA static shell                                    |

No Worker secrets required. Background removal uses the `IMAGES` binding (Cloudflare-native BiRefNet). Non-secret vars (e.g. `APP_ORIGIN`) live in `apps/workers/wrangler.toml` `[vars]` / `[env.production.vars]`.

## GitHub Actions bootstrap

Deploy and dry-run CI use the shared reusable workflow contract from
`webpresso/github-actions` — secret values never land in repo files. Callers pass:

1. callers map `ci_secret_provider_token` from lane-scoped `CI_SECRET_PROVIDER_TOKEN_PREVIEW` or `CI_SECRET_PROVIDER_TOKEN_PRODUCTION` and pass the repo-owned `secret_profile` (`preview` or `production`)

The shared workflow validates the committed profile name and uses the mapped
Doppler config token to inject runtime secrets. Do **not** inline raw token
exports or `DOPPLER_SERVICE_TOKEN` environment wiring inside workflow steps.

The workflow files that consume this action are intentionally pinned to full
40-character commit SHAs, and workflow-path review ownership lives in
[`.github/CODEOWNERS`](../.github/CODEOWNERS). To make that ownership
mandatory, maintainers must enable GitHub branch protection or rulesets with
**Require review from Code Owners**.

The deploy workflow runs `infra/src/deploy/verify-cloudflare-deploy-creds.sh` after
injection:

1. `wrangler whoami` — shows which account(s) the token can access
2. **Workers Services API probe** — same `/workers/services/edge-matte` path
   `wrangler deploy` uses (dry-run alone is not sufficient)
3. `wrangler deploy --dry-run` — bundle validation only

### Required `CLOUDFLARE_API_TOKEN` permissions

`CLOUDFLARE_ACCOUNT_ID` in the configured secret provider must be the **ozby** Cloudflare account
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
2. Update `CLOUDFLARE_API_TOKEN` in the configured secret-provider selection
3. Confirm `CLOUDFLARE_ACCOUNT_ID` stays `e93986039ea9bd9729fa534a29e9e88f`.
4. Locally: `wp secrets run --sink pulumi --profile production -- bash infra/src/deploy/verify-cloudflare-deploy-creds.sh`
5. Re-run **Deploy production** (`workflow_dispatch` on `main` is fine).

## Local bootstrap

1. Install global Webpresso CLIs: `wp` and `vp`.
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

4. **Pulumi (R2 bucket)** — account ID can live in stack config instead of relying on the secret-provider env:

   ```bash
   cd infra
   pulumi stack init production   # once
   pulumi config set cloudflareAccountId "$CLOUDFLARE_ACCOUNT_ID" --secret
   wp secrets run --sink pulumi --profile preview -- vp exec --filter @edge-matte/infra -- pulumi preview
   wp secrets run --sink pulumi --profile production -- vp exec --filter @edge-matte/infra -- pulumi up
   # or from repo root:
   vp run pulumi:up
   ```

5. **Production Worker deploy** (operator-local, same as ingest-lens deploy runbook):

   ```bash
   vp run deploy:production
   ```

   When Cloudflare Access private-beta protection is enabled for
   `edge-matte.ozby.dev`, the same local secret-manager selection must also
   provide `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` so `/health`, `/`,
   and production-only E2E can authenticate without disabling Access.

See [README.md](../README.md) for the full local verification surface and
[`docs/release.md`](./release.md) for maintainer bootstrap from a clean clone.

## Rotation

| Secret                    | Rotation path                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`    | Rotate in Cloudflare dashboard, update the shared secret-provider selection, re-run deploy            |
| `CF_ACCESS_CLIENT_SECRET` | Rotate the Cloudflare Access service token, update the shared secret-provider selection, re-run smoke |
| CI Doppler config tokens  | Rotate the preview / production config tokens in Doppler and update the matching GitHub secrets       |

## Related

- [`docs/release.md`](./release.md) — deploy path and one-time platform setup
- [`docs/architecture.md`](./architecture.md) — deployment ownership boundary
- ingest-lens reference: `docs/secrets/` guidance and `docs/runbooks/dev-deploy.md`
