#!/bin/bash
# Omni 统一平台停止脚本

echo "停止 Omni 平台相关进程..."

# 停止前端 (vite)
pkill -f "vite" 2>/dev/null && echo "前端已停止" || echo "前端未运行"

# 停止后端 (uvicorn)
pkill -f "uvicorn app.main:app" 2>/dev/null && echo "后端已停止" || echo "后端未运行"

echo "Done."
