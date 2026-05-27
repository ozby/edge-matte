#!/usr/bin/env bash
# Poll an HTTP URL until it returns success or attempts are exhausted.
# Usage: ./scripts/wait-for-http.sh <url> [max_attempts] [sleep_seconds]
set -euo pipefail

URL="${1:?url required}"
MAX_ATTEMPTS="${2:-24}"
SLEEP_SECONDS="${3:-5}"

for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
  if curl -sf "$URL" > /dev/null; then
    echo "OK: $URL (attempt ${attempt}/${MAX_ATTEMPTS})"
    exit 0
  fi
  echo "Waiting for ${URL} (${attempt}/${MAX_ATTEMPTS})..."
  sleep "$SLEEP_SECONDS"
done

echo "ERROR: ${URL} did not become healthy after ${MAX_ATTEMPTS} attempts"
exit 1
