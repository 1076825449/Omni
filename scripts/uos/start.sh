#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOST="${TAX_ASSISTANT_HOST:-0.0.0.0}"
LAN_IP="${TAX_ASSISTANT_LAN_IP:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
SECRET_KEY="${SECRET_KEY:-please-change-this-secret-key-before-production}"

export SECRET_KEY
export APP_ENV="${APP_ENV:-production}"
export AUTH_COOKIE_SECURE="${AUTH_COOKIE_SECURE:-false}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://${LAN_IP}:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT}}"
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://${LAN_IP}:${BACKEND_PORT}}"

mkdir -p "${ROOT_DIR}/runtime/pids" "${ROOT_DIR}/runtime/logs"

if [ ! -x "${ROOT_DIR}/backend/.venv/bin/uvicorn" ]; then
  echo "后端虚拟环境未准备，请先在 backend 执行 python3 -m venv .venv 并安装 requirements.txt"
  exit 1
fi

if [ ! -d "${ROOT_DIR}/frontend/node_modules" ]; then
  echo "前端依赖未准备，请先在 frontend 执行 npm install"
  exit 1
fi

if [ -f "${ROOT_DIR}/runtime/pids/backend.pid" ] && kill -0 "$(cat "${ROOT_DIR}/runtime/pids/backend.pid")" 2>/dev/null; then
  echo "后端已在运行"
else
  cd "${ROOT_DIR}/backend"
  nohup .venv/bin/uvicorn app.main:app --host "${HOST}" --port "${BACKEND_PORT}" > "${ROOT_DIR}/runtime/logs/backend.log" 2>&1 &
  echo $! > "${ROOT_DIR}/runtime/pids/backend.pid"
fi

if [ -f "${ROOT_DIR}/runtime/pids/frontend.pid" ] && kill -0 "$(cat "${ROOT_DIR}/runtime/pids/frontend.pid")" 2>/dev/null; then
  echo "前端已在运行"
else
  cd "${ROOT_DIR}/frontend"
  if [ ! -d dist ]; then
    npm run build
  fi
  nohup npm run preview -- --host "${HOST}" --port "${FRONTEND_PORT}" > "${ROOT_DIR}/runtime/logs/frontend.log" 2>&1 &
  echo $! > "${ROOT_DIR}/runtime/pids/frontend.pid"
fi

echo "已启动：前端 http://${LAN_IP}:${FRONTEND_PORT} 后端 http://${LAN_IP}:${BACKEND_PORT}"
