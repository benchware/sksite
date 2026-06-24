#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ -d "${PACKAGE_DIR}/../public" ] && [ -d "${PACKAGE_DIR}/../server" ]; then
  DEFAULT_APP_DIR="$(cd "${PACKAGE_DIR}/.." && pwd)"
else
  DEFAULT_APP_DIR="${PACKAGE_DIR}"
fi

APP_DIR="${APP_DIR:-${DEFAULT_APP_DIR}}"
SK_SITE_DATA_FILE="${SK_SITE_DATA_FILE:-${APP_DIR}/public/assets/data/site-data.json}"

node - <<'NODE' "${SK_SITE_DATA_FILE}"
const fs = require('fs');
const file = process.argv[2];
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const keys = [
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
console.log('Public content counts for', file);
for (const k of keys) {
  console.log(`${k}: ${Array.isArray(data[k]) ? data[k].length : 0}`);
}
NODE
