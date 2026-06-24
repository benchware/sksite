#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CSS="${APP_DIR}/public/assets/css/site.css"
if grep -q "dashboard form typography repair" "${CSS}" && grep -q "#editor-title" "${CSS}"; then
  echo "Dashboard form style patch is present."
else
  echo "Dashboard form style patch is missing."
  exit 1
fi
