#!/usr/bin/env bash
# Fail fast when secret-provider-injected Cloudflare credentials cannot deploy Workers.
# wrangler deploy --dry-run does not hit the Workers Services API; probe that path too.
set -euo pipefail

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID."
  echo "Configure CI_SECRET_PROVIDER_TOKEN or invoke this check through 'wp secrets run --sink deploy-wrangler --profile production -- bash infra/src/deploy/verify-cloudflare-deploy-creds.sh'."
  exit 1
fi

echo "▶ wrangler whoami (token account membership)"
wp exec --filter @edge-matte/worker -- wrangler whoami

echo "▶ Workers Services API auth probe (same path as wrangler deploy)"
bun infra/src/deploy/probe-cloudflare-workers-auth.ts

echo "▶ wrangler deploy dry-run (bundle validation only)"
wp exec --filter @edge-matte/worker -- wrangler deploy --dry-run --env production

echo "OK: Cloudflare deploy credentials verified"
