#!/usr/bin/env bash
set -euo pipefail
SERVICE_NAME="${SERVICE_NAME:-separated-kingdom-admin}"
sudo systemctl disable --now "${SERVICE_NAME}" 2>/dev/null || true
sudo rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
sudo systemctl daemon-reload
echo "Removed systemd service: ${SERVICE_NAME}"
