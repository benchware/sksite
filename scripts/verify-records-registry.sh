#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

required=(
  "public/dashboard/records-registry/index.html"
  "public/dashboard/de/records-registry/index.html"
  "public/assets/js/dashboard-records-registry.js"
)

for f in "${required[@]}"; do
  if [ ! -f "${APP_DIR}/${f}" ]; then
    echo "Missing ${f}"
    exit 1
  fi
done

SERVER="${APP_DIR}/server/index.js"
if ! grep -q "/api/record-registry" "${SERVER}"; then
  echo "Missing record registry admin API."
  exit 1
fi
if ! grep -q "/account-api/record-status" "${SERVER}"; then
  echo "Missing public record-status API."
  exit 1
fi
if ! grep -q "generateCaseNumber" "${SERVER}"; then
  echo "Missing auto case-number generator."
  exit 1
fi
if ! grep -q "syncPublicRecordsFromRegistry" "${SERVER}"; then
  echo "Missing public-record sync."
  exit 1
fi

node --check "${APP_DIR}/server/index.js"
node --check "${APP_DIR}/public/assets/js/dashboard-records-registry.js"
node --check "${APP_DIR}/public/assets/js/request-status.js"
node --check "${APP_DIR}/public/assets/js/public-records.js"

echo "Records registry check passed."
