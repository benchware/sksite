#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SERVER="${APP_DIR}/server/index.js"

if grep -q "ADMIN_COOKIE_NAME" "${SERVER}" && grep -q "/admin-auth/login" "${SERVER}" && grep -q "ensureBootstrapAdmin" "${SERVER}"; then
  echo "Dashboard web-login server auth patch is present."
else
  echo "Dashboard web-login server auth patch is missing."
  exit 1
fi

if [ -f "${APP_DIR}/Caddyfile" ]; then
  if grep -q "basic_auth" "${APP_DIR}/Caddyfile"; then
    echo "Caddyfile still has basic_auth."
    exit 1
  fi
  if grep -q "forward_auth" "${APP_DIR}/Caddyfile" && grep -q "@adminAuth" "${APP_DIR}/Caddyfile"; then
    echo "Caddyfile uses app web-login auth."
  else
    echo "Caddyfile is missing forward_auth/admin-auth."
    exit 1
  fi
fi

if [ -f "${APP_DIR}/Caddyfile.example" ]; then
  if grep -q "basic_auth" "${APP_DIR}/Caddyfile.example"; then
    echo "Caddyfile.example still has basic_auth."
    exit 1
  fi
  if grep -q "forward_auth" "${APP_DIR}/Caddyfile.example" && grep -q "@adminAuth" "${APP_DIR}/Caddyfile.example"; then
    echo "Caddyfile.example uses app web-login auth."
  else
    echo "Caddyfile.example is missing forward_auth/admin-auth."
    exit 1
  fi
fi
