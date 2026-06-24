#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CSS="${APP_DIR}/public/assets/css/site.css"
EN="${APP_DIR}/public/en/index.html"
DE="${APP_DIR}/public/de/index.html"

if ! grep -q "homepage quick-links and topic-grid cleanup" "${CSS}"; then
  echo "Homepage cleanup CSS marker missing."
  exit 1
fi

if ! grep -q "sk-ca-most-requested" "${EN}" || ! grep -q "sk-ca-topics" "${EN}"; then
  echo "English homepage sections missing."
  exit 1
fi

if ! grep -q "sk-ca-most-requested" "${DE}" || ! grep -q "sk-ca-topics" "${DE}"; then
  echo "German homepage sections missing."
  exit 1
fi

if grep -q "private Anfragezentrumn" "${DE}"; then
  echo "Broken German wording still present."
  exit 1
fi

echo "Homepage quick-links cleanup check passed."
