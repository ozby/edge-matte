---
type: guide
title: EdgeMatte secrets
status: draft
created: 2026-05-27
last_updated: 2026-05-27
---

# EdgeMatte secrets

EdgeMatte never stores provider or deploy credentials in the repository.
Secret **values** live in Cloudflare or a team secret manager; the repo documents
**names**, bootstrap paths, and ownership only.

Release context: [`docs/release.md`](./release.md).

## Forbidden on disk

Do not create or commit:

- `.dev.vars` or `.dev.vars.example`
- `.env`, `.env.local`, or other `.env.*` files (except `.env.example` if used
  purely as documentation with no real values)

Pre-commit and CI enforce this via `scripts/check-no-dev-vars.ts` and
`pnpm run verify:secrets`.

Provider-specific CLI patterns that bypass the quarantine layer are blocked by
`pnpm run audit:secret-provider-quarantine` (e.g. invoking Doppler directly in
repo scripts instead of the provider-neutral wrapper).

## GitHub vs Cloudflare vs Doppler

| Secret / credential | Where the value lives | Who sets it | Used by |
| --- | --- | --- | --- |
| `PHOTOROOM_API_KEY` | **Cloudflare Worker secret** (production) | Maintainer via `wrangler secret put` | Worker at runtime |
| `CLOUDFLARE_API_TOKEN` | **GitHub Actions secret** | Repo admin | CI deploy job only |
| `CLOUDFLARE_ACCOUNT_ID` | **GitHub Actions secret** (or workflow env) | Repo admin | CI deploy job |
| Local dev provider keys | **Doppler** (or manager selected in `wp config`) | Each developer | Local `wrangler dev`, tests, e2e |
| `GH_PACKAGES_TOKEN` | **Environment at runtime** | Developer/CI when needed | Private `@webpresso/*` installs — **not** required for this repo's public `pnpm install` |

### Rules

1. **Provider keys never go to GitHub.** Photoroom and similar third-party API
   keys are Cloudflare Worker secrets in production and secret-manager injected
   locally — never repository or Actions secrets.
2. **GitHub holds deploy capability only.** Tokens in GitHub Actions exist to let
   Wrangler authenticate to Cloudflare for `wrangler deploy`; they do not carry
   application provider credentials.
3. **Wrangler declares names; Cloudflare holds values.** `wrangler.toml` and
   TypeScript `Env` types reference binding/secret names. Values are set with
   `wrangler secret put` or the Cloudflare dashboard.
4. **Local bootstrap uses `wp`, not files.** Configure once:
   `wp config secrets set doppler edge-matte` (or your team's project/config).
   Commands that need secrets should use the repo's provider-neutral wrapper
   patterns, not ad-hoc `.env` files.

## Worker secrets and bindings

Production Worker runtime expects (names stable; values out-of-band):

| Name | Kind | Purpose |
| --- | --- | --- |
| `PHOTOROOM_API_KEY` | Secret | Background removal provider |
| `IMAGES_BUCKET` | R2 binding | Job metadata and image objects |
| `IMAGES` | Images binding | Horizontal flip transform |
| `ASSETS` | Assets binding | SPA static shell |

Non-secret vars (e.g. `APP_ORIGIN`) live in `wrangler.toml` `[vars]` /
`[env.production.vars]`.

### Set production provider secret

```bash
cd apps/worker
wrangler secret put PHOTOROOM_API_KEY --env production
```

Verify the secret is present (name only — Wrangler does not print values):

```bash
wrangler secret list --env production
```

## GitHub Actions bootstrap

Repository secrets required for automated deploy (blueprint `IR-6`):

| GitHub secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token scoped to Workers deploy + account access |
| `CLOUDFLARE_ACCOUNT_ID` | Target Cloudflare account |

Create a Cloudflare API token with minimal scope: Workers Scripts edit, Account
read, and any R2 permissions Wrangler needs for binding validation. Do **not**
embed `PHOTOROOM_API_KEY` in GitHub.

Illustrative workflow usage:

```yaml
env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## Local bootstrap

1. Install global Webpresso CLIs: `wp` and `vp` on your `PATH`.
2. Configure your secret manager for this project:

   ```bash
   wp config secrets set doppler edge-matte
   ```

3. Install dependencies and run policy checks:

   ```bash
   pnpm install --frozen-lockfile
   pnpm run verify:secrets
   pnpm run audit:secret-provider-quarantine
   ```

4. Run local Worker dev with secrets injected through your manager + Wrangler
   (never commit local override files).

See [README.md](../README.md) for the full local verification surface and
[`docs/release.md`](./release.md) for maintainer bootstrap from a clean clone.

## Rotation

| Secret | Rotation path |
| --- | --- |
| `PHOTOROOM_API_KEY` | Update in Cloudflare (`wrangler secret put`), redeploy not required for secret-only updates; verify with smoke e2e |
| `CLOUDFLARE_API_TOKEN` | Rotate in Cloudflare dashboard, update GitHub secret, trigger deploy workflow |
| Doppler/local keys | Rotate in Doppler; developers refresh local sessions |

## Related

- [`docs/release.md`](./release.md) — deploy path and one-time platform setup
- [`docs/architecture.md`](./architecture.md) — deployment ownership boundary
- [`AGENTS.md`](../AGENTS.md) — repo secret-handling policy
