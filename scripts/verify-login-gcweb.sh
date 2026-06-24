#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
EN="${APP_DIR}/public/dashboard/login/index.html"
DE="${APP_DIR}/public/dashboard/de/login/index.html"
CSS="${APP_DIR}/public/assets/css/site.css"

for f in "${EN}" "${DE}"; do
  if grep -q "admin-login-shell\|admin-login-hero\|admin-login-body\|admin-login-trust" "$f"; then
    echo "Non-GCWeb SaaS-style login markup still present in $f"
    exit 1
  fi
  if ! grep -q "well sk-gcweb-login-panel" "$f"; then
    echo "GCWeb login well missing in $f"
    exit 1
  fi
  if ! grep -q "panel panel-default" "$f"; then
    echo "GCWeb side panel missing in $f"
    exit 1
  fi
  if grep -q "First-time setup\|Ersteinrichtung\|admin-initial-password.txt" "$f"; then
    echo "Old setup note still present in $f"
    exit 1
  fi
done

if ! grep -q "GCWeb-style dashboard sign-in page" "${CSS}"; then
  echo "GCWeb login CSS marker missing."
  exit 1
fi

echo "GCWeb-style login page check passed."
