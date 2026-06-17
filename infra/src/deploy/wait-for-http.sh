#!/usr/bin/env bash
# Poll an HTTP URL until it returns success or attempts are exhausted.
# Usage: ./infra/src/deploy/wait-for-http.sh <url> [max_attempts] [sleep_seconds]
set -euo pipefail

URL="${1:?url required}"
MAX_ATTEMPTS="${2:-24}"
SLEEP_SECONDS="${3:-5}"
ACCESS_CLIENT_ID="${CF_ACCESS_CLIENT_ID:-}"
ACCESS_CLIENT_SECRET="${CF_ACCESS_CLIENT_SECRET:-}"

if [[ -n "$ACCESS_CLIENT_ID" || -n "$ACCESS_CLIENT_SECRET" ]]; then
  if [[ -z "$ACCESS_CLIENT_ID" || -z "$ACCESS_CLIENT_SECRET" ]]; then
    echo "ERROR: both CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET are required when either one is set"
    exit 1
  fi
  CURL_ARGS=(
    -sS
    -o /dev/null
    -w "%{http_code}"
    -H "CF-Access-Client-Id: ${ACCESS_CLIENT_ID}"
    -H "CF-Access-Client-Secret: ${ACCESS_CLIENT_SECRET}"
  )
else
  CURL_ARGS=(-sS -o /dev/null -w "%{http_code}")
fi

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
  status="$(curl "${CURL_ARGS[@]}" "$URL" || true)"
  if [[ "$status" =~ ^2[0-9][0-9]$ ]]; then
    echo "OK: $URL (attempt ${attempt}/${MAX_ATTEMPTS}, status ${status})"
    exit 0
  fi
  echo "Waiting for ${URL} (${attempt}/${MAX_ATTEMPTS}, last status ${status:-000})..."
  sleep "$SLEEP_SECONDS"
done

echo "ERROR: ${URL} did not become healthy after ${MAX_ATTEMPTS} attempts"
exit 1
