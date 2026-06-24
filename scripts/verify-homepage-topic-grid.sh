#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CSS="${APP_DIR}/public/assets/css/site.css"
EN="${APP_DIR}/public/en/index.html"
DE="${APP_DIR}/public/de/index.html"

if ! grep -q "fix DE homepage float gaps" "${CSS}"; then
  echo "Missing homepage topic-grid float-gap fix."
  exit 1
fi

if ! grep -q "grid-template-columns: repeat(3" "${CSS}"; then
  echo "Missing 3-column grid rule."
  exit 1
fi

if ! grep -q "float: none !important" "${CSS}"; then
  echo "Missing Bootstrap float override."
  exit 1
fi

if ! grep -q ".sk-ca-topics > .row::before" "${CSS}" || ! grep -q ".sk-ca-topics > .row::after" "${CSS}"; then
  echo "Missing Bootstrap clearfix pseudo-element override."
  exit 1
fi

if ! grep -q "sk-ca-topics" "${EN}" || ! grep -q "sk-ca-topics" "${DE}"; then
  echo "Homepage topic section missing."
  exit 1
fi

echo "Homepage topic-grid layout check passed."
