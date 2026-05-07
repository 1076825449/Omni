#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

stop_pid() {
  local name="$1"
  local pid_file="${ROOT_DIR}/runtime/pids/${name}.pid"
  if [ -f "${pid_file}" ]; then
    local pid
    pid="$(cat "${pid_file}")"
    if kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}"
      echo "已停止 ${name}: ${pid}"
    fi
    rm -f "${pid_file}"
  else
    echo "${name} 未记录运行进程"
  fi
}

stop_pid frontend
stop_pid backend
