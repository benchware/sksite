#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

if grep -R "First-time setup\|Ersteinrichtung" "${APP_DIR}/public/dashboard/login" "${APP_DIR}/public/dashboard/de/login" >/dev/null; then
  echo "Login setup note is still present."
  exit 1
fi

echo "Login setup note removed."
