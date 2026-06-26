#!/usr/bin/env bash
set -euo pipefail

# Manual server health check template.
# Usage:
#   HOST=101.35.218.126 USER=ubuntu ./deploy/check_server.sh

HOST="${HOST:-101.35.218.126}"
USER="${USER:-ubuntu}"
REMOTE_DIR="/var/www/sgcc-exam-miniapp/server"
PM2_NAME="${PM2_NAME:-sgcc-exam-api}"
API_BASE_URL="${API_BASE_URL:-https://api.synexa.cc}"

ssh "${USER}@${HOST}" "pm2 describe '${PM2_NAME}' | grep -q 'exec cwd.*${REMOTE_DIR}' && cd '${REMOTE_DIR}' && pwd && pm2 status && API_BASE_URL='${API_BASE_URL}' npm run check:health && curl -fsS '${API_BASE_URL}/api/ai/status' && echo"
