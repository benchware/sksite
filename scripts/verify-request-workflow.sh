#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

required=(
  "public/en/requests/index.html"
  "public/de/requests/index.html"
  "public/en/request-status/index.html"
  "public/de/request-status/index.html"
  "public/assets/js/request-status.js"
)

for f in "${required[@]}"; do
  if [ ! -f "${APP_DIR}/${f}" ]; then
    echo "Missing ${f}"
    exit 1
  fi
done

if ! grep -q "/account-api/request-status" "${APP_DIR}/server/index.js"; then
  echo "Missing request status API endpoint."
  exit 1
fi

if ! grep -q "Request submitted successfully" "${APP_DIR}/public/assets/js/service-request.js"; then
  echo "Missing clearer request success message."
  exit 1
fi

if ! grep -q "Record tag" "${APP_DIR}/public/en/records/request/index.html"; then
  echo "Missing record tag field."
  exit 1
fi

node --check "${APP_DIR}/public/assets/js/service-request.js"
node --check "${APP_DIR}/public/assets/js/request-status.js"
node --check "${APP_DIR}/public/assets/js/dashboard-requests.js"
node --check "${APP_DIR}/server/index.js"

echo "Request workflow check passed."
