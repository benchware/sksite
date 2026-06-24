#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CSS="${APP_DIR}/public/assets/css/site.css"
DE="${APP_DIR}/public/de/index.html"

if ! grep -q "stronger DE/homepage link cleanup" "${CSS}"; then
  echo "Missing stronger DE/homepage CSS marker."
  exit 1
fi

if ! grep -q "html\[lang=\"de\"\] .sk-ca-most-requested" "${CSS}"; then
  echo "Missing German-specific homepage CSS."
  exit 1
fi

if ! grep -q "!important" "${CSS}"; then
  echo "Missing stronger visited-link override."
  exit 1
fi

bad='private Anfragezentrumn\|Akte anfordern</a></li>\|private Anfragezentrum'
if grep -qE "${bad}" "${DE}"; then
  echo "Broken German homepage wording still present."
  exit 1
fi

if ! grep -q "Anfragezentrum" "${DE}"; then
  echo "German request-centre wording missing."
  exit 1
fi

echo "German homepage cleanup check passed."
