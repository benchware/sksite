#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

echo "Separated Kingdom GCWeb open-source installer"
echo "App directory: ${APP_DIR}"
echo

cd "${APP_DIR}"
chmod +x scripts/*.sh

echo "Step 1/3: Installing/restarting Node API..."
./scripts/install-node-api-systemd.sh

echo
echo "Step 2/3: Installing Caddyfile..."
if [ -f "${APP_DIR}/Caddyfile" ]; then
  ./scripts/install-caddyfile.sh
else
  echo "Skipping Caddy install because Caddyfile is missing."
  echo "Copy Caddyfile.example to Caddyfile and replace the placeholder Basic Auth hash."
fi

echo
echo "Step 3/3: Direct API health check..."
curl -i "http://127.0.0.1:${PORT:-8787}/api/health" || true

echo
echo "Install script complete."
