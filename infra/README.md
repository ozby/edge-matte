# EdgeMatte infrastructure (Pulumi)

Pulumi owns **durable** Cloudflare resources for EdgeMatte. Wrangler owns the Worker,
routes, bindings, and deploy — see [`wrangler.toml`](../wrangler.toml) and
[`docs/release.md`](../docs/release.md).

## Resources

| Resource | Name / scope |
| --- | --- |
| R2 bucket | `edge-matte-images` (bound as `IMAGES_BUCKET` in Wrangler) |
| R2 lifecycle | Delete `jobs/*` and `images/*` objects older than `artifactMaxAgeDays` (default 30) |

Object key layout matches the Worker (`apps/worker/src/core/object-keys.ts`):

- `jobs/{id}.json` — job metadata
- `images/{id}/original` — upload
- `images/{id}/processed` — hosted result

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/install/)
- Cloudflare account ID (`CLOUDFLARE_ACCOUNT_ID` or Pulumi config)
- API token with R2 read/write for the account

## Bootstrap

From the repo root:

```bash
pnpm install
cd infra
pulumi login
pulumi stack init production   # once
pulumi config set cloudflareAccountId "$CLOUDFLARE_ACCOUNT_ID" --secret
pulumi config set artifactMaxAgeDays 30
pulumi preview
pulumi up
```

Then deploy the Worker with Wrangler (bucket must exist before production traffic).

## Verification

Repo-level infra contract tests (no Cloudflare credentials required):

```bash
cd ..
node --test test/infra/pulumi-ownership.test.mjs
```

## Ownership

Do **not** create the R2 bucket or lifecycle rules in Wrangler. Do **not** deploy the
Worker from this stack.
