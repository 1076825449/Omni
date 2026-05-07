#!/usr/bin/env bash
set -euo pipefail

LAN_IP="${TAX_ASSISTANT_LAN_IP:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

echo "检查后端：http://${LAN_IP}:${BACKEND_PORT}/"
curl -fsS "http://${LAN_IP}:${BACKEND_PORT}/" >/dev/null && echo "后端正常"

echo "检查前端：http://${LAN_IP}:${FRONTEND_PORT}/"
curl -fsS "http://${LAN_IP}:${FRONTEND_PORT}/" >/dev/null && echo "前端正常"
