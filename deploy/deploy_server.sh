#!/usr/bin/env bash
set -euo pipefail

# Manual server deployment template.
# Usage:
#   HOST=101.35.218.126 USER=ubuntu ./deploy/deploy_server.sh

HOST="${HOST:-101.35.218.126}"
USER="${USER:-ubuntu}"
REMOTE_DIR="/var/www/sgcc-exam-miniapp/server"
PM2_NAME="${PM2_NAME:-sgcc-exam-api}"
LOCAL_SERVER_DIR="${LOCAL_SERVER_DIR:-server}"
STAMP="$(date +%Y%m%d%H%M%S)"

echo "Deploying server to ${USER}@${HOST}:${REMOTE_DIR}"
echo "Backup stamp: ${STAMP}"

ssh "${USER}@${HOST}" "pm2 describe '${PM2_NAME}' | grep -q 'exec cwd.*${REMOTE_DIR}'"

ssh "${USER}@${HOST}" "mkdir -p '${REMOTE_DIR}' && cd '${REMOTE_DIR}' && [ -f server.js ] && cp server.js server.js.bak_${STAMP} || true && [ -f .env ] && cp .env .env.bak_${STAMP} || true"

scp "${LOCAL_SERVER_DIR}/server.js" "${USER}@${HOST}:${REMOTE_DIR}/server.js"
scp "${LOCAL_SERVER_DIR}/wechat-pay.js" "${USER}@${HOST}:${REMOTE_DIR}/wechat-pay.js"
scp "${LOCAL_SERVER_DIR}/package.json" "${USER}@${HOST}:${REMOTE_DIR}/package.json"
scp "${LOCAL_SERVER_DIR}/package-lock.json" "${USER}@${HOST}:${REMOTE_DIR}/package-lock.json"
ssh "${USER}@${HOST}" "mkdir -p '${REMOTE_DIR}/scripts'"
scp "${LOCAL_SERVER_DIR}/scripts/health-check.js" "${USER}@${HOST}:${REMOTE_DIR}/scripts/health-check.js"

echo "Secrets are not copied by default. Manage .env and certificates on the server at ${REMOTE_DIR}."

ssh "${USER}@${HOST}" "cd '${REMOTE_DIR}' && npm install && pm2 restart '${PM2_NAME}' --update-env && pm2 status && API_BASE_URL='https://api.synexa.cc' npm run check:health && curl -fsS https://api.synexa.cc/api/ai/status && echo"
