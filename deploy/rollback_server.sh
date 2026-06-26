#!/usr/bin/env bash
set -euo pipefail

# Manual rollback template.
# Usage:
#   HOST=101.35.218.126 USER=ubuntu BACKUP_STAMP=20260626091251 ./deploy/rollback_server.sh

HOST="${HOST:-101.35.218.126}"
USER="${USER:-ubuntu}"
REMOTE_DIR="/var/www/sgcc-exam-miniapp/server"
PM2_NAME="${PM2_NAME:-sgcc-exam-api}"
BACKUP_STAMP="${BACKUP_STAMP:?Set BACKUP_STAMP to the backup suffix, for example 20260626091251}"

ssh "${USER}@${HOST}" "cd '${REMOTE_DIR}' && test -f server.js.bak_${BACKUP_STAMP} && cp server.js.bak_${BACKUP_STAMP} server.js && if [ -f .env.bak_${BACKUP_STAMP} ]; then cp .env.bak_${BACKUP_STAMP} .env; fi && npm install && pm2 restart '${PM2_NAME}' --update-env && pm2 status"
