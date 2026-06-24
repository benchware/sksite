#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SERVER="${APP_DIR}/server/index.js"

needles=(
  "ADMIN_LOGIN_RATE_WINDOW_MS"
  "recordLoginFailure"
  "csrfMatches"
  "ADMIN_SESSION_MAX_AGE_SECONDS"
  "canAccessAdminApi"
  "change-password"
  "verifyTotp"
  "sanitizeDeep"
  ".listen(PORT, HOST"
)

for n in "${needles[@]}"; do
  if ! grep -q "$n" "$SERVER"; then
    echo "Missing hardening marker: $n"
    exit 1
  fi
done

if grep -q "Access-Control-Allow-Headers.*X-CSRF-Token" "$SERVER"; then
  echo "CSRF header is allowed."
else
  echo "Missing X-CSRF-Token allowed header."
  exit 1
fi

echo "Security hardening markers are present."
