#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CADDY_SOURCE="${CADDY_SOURCE:-${APP_DIR}/Caddyfile}"

if [ ! -f "${CADDY_SOURCE}" ]; then
  echo "No Caddyfile found at ${CADDY_SOURCE}"
  echo
  echo "Open-source package ships Caddyfile.example only."
  echo "Copy it first and replace APP_COOKIE_LOGIN:"
  echo "  cp Caddyfile.example Caddyfile"
  echo "  caddy hash-password --plaintext 'your-password'"
  echo
  exit 1
fi

sudo mkdir -p /etc/caddy
sudo cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.backup.$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
sudo APP_ROOT="${APP_DIR}" caddy fmt --overwrite "${CADDY_SOURCE}"
sudo cp "${CADDY_SOURCE}" /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl restart caddy
sudo systemctl status caddy --no-pager -l || true

echo
echo "Caddy health checks:"
curl -i http://127.0.0.1/api/health || true
echo
curl -i http://127.0.0.1/election-api/elections || true
