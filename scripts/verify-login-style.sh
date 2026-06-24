#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
EN="${APP_DIR}/public/dashboard/login/index.html"
DE="${APP_DIR}/public/dashboard/de/login/index.html"
CSS="${APP_DIR}/public/assets/css/site.css"

for f in "${EN}" "${DE}"; do
  if ! grep -q "admin-login-shell" "$f"; then
    echo "Login shell missing in $f"
    exit 1
  fi
  if ! grep -q "admin-login-hero" "$f"; then
    echo "Login hero missing in $f"
    exit 1
  fi
  if grep -q "First-time setup\|Ersteinrichtung" "$f"; then
    echo "Old setup note still present in $f"
    exit 1
  fi
done

if ! grep -q "polished dashboard sign-in page" "${CSS}"; then
  echo "Polished login CSS marker missing."
  exit 1
fi

echo "Polished login page check passed."
