# Phase 2 任务包

> 说明：本文件为历史任务包，部分内容已完成、部分实现路径已调整。后续开发请不要直接依据本文件判断当前状态，统一以仓库根目录的 `ROADMAP.md` 和 `最终验收清单.md` 为准。

## 目标
平台生产级部署能力 + 自动化测试保障

## 任务 20：Docker Compose 一键部署

### 必须完成
- `docker-compose.yml` — 后端 + 前端 + PostgreSQL + Nginx(可选)
- `Dockerfile` (后端) — Python + uvicorn
- `Dockerfile` (前端) — Node + Vite build
- `.env.example` — 环境变量模板
- `README.md` 更新部署说明

### 验收
- `docker-compose up` 可启动全部服务
- 数据库持久化到 named volume
- 前端构建后由 Nginx 或直接 5173 访问

## 任务 21：PostgreSQL 支持（可选，生产推荐）

### 必须完成
- `app/core/database.py` 支持 PostgreSQL（通过 `DATABASE_URL` 切换）
- SQLite 作为默认，开发友好
- 生产环境推荐 PostgreSQL
- SQLAlchemy 模型兼容 PostgreSQL（注意 text vs varchar）

### 验收
- `DATABASE_URL=postgresql://...` 时连接 PostgreSQL
- `DATABASE_URL` 为空时回退 SQLite

## 任务 22：自动化测试

### 必须完成
- 后端 `pytest` 冒烟测试（登录/任务/文件/搜索 API）
- 前端 Playwright 冒烟测试（登录/首页/模块跳转）
- `tests/README.md` 说明运行方式

### 验收
- `pytest` 至少 5 个核心 API 测试通过
- `playwright test` 至少 3 个页面测试通过

## 任务 23：环境变量与配置外置

### 必须完成
- `backend/.env` 支持所有配置（DATABASE_URL / SECRET_KEY / CORS_ORIGINS）
- 后端启动脚本读取环境变量
- 不硬编码任何敏感信息

### 验收
- 无 `.env` 时平台仍可用（使用默认 SQLite）
- 有 `.env` 时优先读取环境变量

## Git 要求

每个任务完成后单独 commit，格式：
```
[Phase2-任务20] Docker Compose 一键部署
[Phase2-任务21] PostgreSQL 支持
[Phase2-任务22] 自动化测试
[Phase2-任务23] 配置外置与环境变量
```
