#!/usr/bin/env bash
set -euo pipefail

# Repairs dashboard support content when Easy Mode / Advanced JSON / Translation Checker
# / campaigns / alerts / elections are empty because site-data.json was preserved empty.
#
# Safe:
# - only repairs public/assets/data/site-data.json
# - does NOT touch data/separated-kingdom.sqlite
# - does NOT touch users/sessions/requests/votes/audit DB/runtime files

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ -d "${PACKAGE_DIR}/../public" ] && [ -d "${PACKAGE_DIR}/../server" ]; then
  DEFAULT_APP_DIR="$(cd "${PACKAGE_DIR}/.." && pwd)"
else
  DEFAULT_APP_DIR="${PACKAGE_DIR}"
fi

APP_DIR="${APP_DIR:-${DEFAULT_APP_DIR}}"
TARGET="${SK_SITE_DATA_TARGET:-${APP_DIR}/public/assets/data/site-data.json}"

if [ -f "${APP_DIR}/public/assets/data/site-data.bundled-example.json" ]; then
  SOURCE="${SK_SITE_DATA_SOURCE:-${APP_DIR}/public/assets/data/site-data.bundled-example.json}"
else
  SOURCE="${SK_SITE_DATA_SOURCE:-${PACKAGE_DIR}/public/assets/data/site-data.bundled-example.json}"
fi

BACKUP_DIR="${SK_CONTENT_BACKUP_DIR:-${APP_DIR}/backup-dashboard-repair-$(date +%Y%m%d-%H%M%S)}"

if [ ! -f "${SOURCE}" ]; then
  echo "ERROR: bundled example content file not found."
  echo "Checked:"
  echo "  ${APP_DIR}/public/assets/data/site-data.bundled-example.json"
  echo "  ${PACKAGE_DIR}/public/assets/data/site-data.bundled-example.json"
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
mkdir -p "$(dirname "${TARGET}")"

if [ -f "${TARGET}" ]; then
  cp "${TARGET}" "${BACKUP_DIR}/site-data.before-repair.json"
fi

node - <<'NODE' "${TARGET}" "${SOURCE}"
const fs = require('fs');
const path = require('path');
const target = process.argv[2];
const source = process.argv[3];

const listKeys = [
  'news',
  'incidentReports',
  'advisories',
  'gazette',
  'services',
  'transparency',
  'records',
  'states',
  'departments',
  'organizations',
  'legalDocuments',
  'statusDashboard',
  'alerts',
  'campaigns',
  'elections'
];
const objectKeys = ['alertSettings', 'campaignSettings', 'votingSettings'];

function read(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}
function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

const live = isObject(read(target, {})) ? read(target, {}) : {};
const bundled = read(source, {});
let changed = false;

for (const key of listKeys) {
  if (!Array.isArray(live[key]) || live[key].length === 0) {
    if (Array.isArray(bundled[key])) {
      live[key] = bundled[key];
      changed = true;
    }
  }
}
for (const key of objectKeys) {
  if (!isObject(live[key]) || Object.keys(live[key]).length === 0) {
    if (isObject(bundled[key])) {
      live[key] = bundled[key];
      changed = true;
    }
  }
}
if (!live.lastModified && bundled.lastModified) {
  live.lastModified = bundled.lastModified;
  changed = true;
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(live, null, 2));

const counts = {};
for (const key of listKeys) counts[key] = Array.isArray(live[key]) ? live[key].length : 0;
console.log(JSON.stringify({ ok: true, changed, target, source, counts }, null, 2));
NODE

echo
echo "Backup saved to:"
echo "  ${BACKUP_DIR}"
echo
echo "Restart services if running:"
echo "  sudo systemctl restart separated-kingdom-admin"
echo "  sudo systemctl restart caddy"
