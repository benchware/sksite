#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${APP_DIR}/backup-$(date +%Y%m%d-%H%M%S)"

echo "Separated Kingdom GCWeb safe upgrade"
echo "Package: ${PACKAGE_DIR}"
echo "App: ${APP_DIR}"
echo "Backup: ${BACKUP_DIR}"

mkdir -p "${BACKUP_DIR}"

[ -f "${APP_DIR}/public/assets/data/site-data.json" ] && cp "${APP_DIR}/public/assets/data/site-data.json" "${BACKUP_DIR}/site-data.json"
[ -d "${APP_DIR}/data" ] && cp -a "${APP_DIR}/data" "${BACKUP_DIR}/data"

cp -a "${PACKAGE_DIR}/." "${APP_DIR}/"

if [ -f "${BACKUP_DIR}/site-data.json" ]; then
  mkdir -p "${APP_DIR}/public/assets/data"
  cp "${BACKUP_DIR}/site-data.json" "${APP_DIR}/public/assets/data/site-data.json"
fi
if [ -d "${BACKUP_DIR}/data" ]; then
  rm -rf "${APP_DIR}/data"
  cp -a "${BACKUP_DIR}/data" "${APP_DIR}/data"
fi

chmod +x "${APP_DIR}/scripts/"*.sh

echo
echo "Upgrade copy complete. Backups are in ${BACKUP_DIR}"
echo "Run ./scripts/repair-dashboard-content.sh if dashboard content arrays are empty."
