#!/bin/bash
# Omni 统一平台启动脚本

set -e

echo "=========================================="
echo "Omni 统一平台启动脚本"
echo "=========================================="

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# 检查 Python 环境
check_python() {
    echo -n "检查 Python... "
    if command -v python3 &> /dev/null; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}未找到 python3${NC}"
        exit 1
    fi
}

# 检查 Node 环境
check_node() {
    echo -n "检查 Node.js... "
    if command -v node &> /dev/null; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}未找到 node${NC}"
        exit 1
    fi
}

# 检查后端依赖
check_backend_deps() {
    echo -n "检查后端依赖... "
    if [ -f "$BACKEND_DIR/.venv/bin/activate" ]; then
        echo -e "${GREEN}OK (venv 已存在)${NC}"
    else
        echo -e "${YELLOW}需要创建虚拟环境${NC}"
        cd "$BACKEND_DIR"
        python3 -m venv .venv
        source .venv/bin/activate
        pip install -q fastapi uvicorn sqlalchemy pydantic python-multipart httpx
        echo -e "${GREEN}后端依赖安装完成${NC}"
    fi
}

# 启动后端
start_backend() {
    echo -e "${YELLOW}启动后端 (端口 3000)...${NC}"
    cd "$BACKEND_DIR"
    if [ ! -f ".venv/bin/activate" ]; then
        python3 -m venv .venv
        source .venv/bin/activate
        pip install -q fastapi uvicorn sqlalchemy pydantic python-multipart httpx
    fi
    source .venv/bin/activate
    uvicorn app.main:app --reload --port 3000 &
    BACKEND_PID=$!
    echo -e "${GREEN}后端已启动 (PID: $BACKEND_PID)${NC}"
}

# 启动前端
start_frontend() {
    echo -e "${YELLOW}启动前端 (端口 5173)...${NC}"
    cd "$FRONTEND_DIR"
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    npm run dev &
    FRONTEND_PID=$!
    echo -e "${GREEN}前端已启动 (PID: $FRONTEND_PID)${NC}"
}

# 主函数
main() {
    check_python
    check_node
    check_backend_deps

    echo ""
    echo -e "${GREEN}开始启动服务...${NC}"
    echo ""

    start_backend
    sleep 2
    start_frontend

    echo ""
    echo "=========================================="
    echo -e "${GREEN}Omni 平台已启动！${NC}"
    echo "=========================================="
    echo "后端：http://localhost:3000"
    echo "前端：http://localhost:5173"
    echo "测试账号：admin / admin123"
    echo ""
    echo "按 Ctrl+C 停止所有服务"
    echo "=========================================="

    # 等待
    wait
}

main "$@"
