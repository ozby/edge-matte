#!/usr/bin/env bash
# Fail fast when Doppler-injected Cloudflare credentials cannot deploy Workers.
set -euo pipefail

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID."
  echo "Configure DOPPLER_SERVICE_TOKEN scoped to ozby-shell (prd config)."
  exit 1
fi

echo "▶ wrangler whoami"
pnpm --filter @edge-matte/worker exec wrangler whoami

echo "▶ wrangler deploy dry-run (production)"
pnpm --filter @edge-matte/worker exec wrangler deploy --dry-run --env production

echo "OK: Cloudflare deploy credentials verified"
