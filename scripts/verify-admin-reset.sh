#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SCRIPT="${APP_DIR}/scripts/reset-admin-password.sh"

if [ ! -f "${SCRIPT}" ]; then
  echo "Missing reset-admin-password.sh"
  exit 1
fi

bash -n "${SCRIPT}"

if grep -q "mustChangePassword" "${SCRIPT}" && grep -q "passwordHash" "${SCRIPT}" && grep -q "admin-initial-password.txt" "${SCRIPT}"; then
  echo "Admin reset script check passed."
else
  echo "Admin reset script is missing required markers."
  exit 1
fi
