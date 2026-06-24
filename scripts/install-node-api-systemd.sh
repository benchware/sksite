#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SERVICE_NAME="${SERVICE_NAME:-separated-kingdom-admin}"
SERVICE_USER="${SERVICE_USER:-$(id -un)}"
NODE_BIN="${NODE_BIN:-$(command -v node)}"
PORT="${PORT:-8787}"
HOST="${HOST:-127.0.0.1}"
DB_MODE="${DB_MODE:-sqlite}"
DATA_DIR="${DATA_DIR:-${APP_DIR}/data}"
DATA_FILE="${DATA_FILE:-${APP_DIR}/public/assets/data/site-data.json}"
DB_FILE="${DB_FILE:-${DATA_DIR}/separated-kingdom.sqlite}"
BUNDLED_CONTENT_FILE="${BUNDLED_CONTENT_FILE:-${APP_DIR}/public/assets/data/site-data.bundled-example.json}"

if [ -z "${NODE_BIN}" ]; then
  echo "Node.js not found. Install Node.js first or set NODE_BIN=/path/to/node"
  exit 1
fi

sudo mkdir -p "${DATA_DIR}"
sudo chown -R "${SERVICE_USER}" "${DATA_DIR}" "${APP_DIR}/public/assets/data" || true

cat <<SERVICE | sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" >/dev/null
[Unit]
Description=Separated Kingdom GCWeb API
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT}
Environment=HOST=${HOST}
Environment=DB_MODE=${DB_MODE}
Environment=DATA_DIR=${DATA_DIR}
Environment=DATA_FILE=${DATA_FILE}
Environment=DB_FILE=${DB_FILE}
Environment=BUNDLED_CONTENT_FILE=${BUNDLED_CONTENT_FILE}
ExecStart=${NODE_BIN} ${APP_DIR}/server/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl status "${SERVICE_NAME}" --no-pager -l || true
