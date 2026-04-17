# Omni 统一平台

全新统一平台项目，从零开始定义和构建。Phase 1 已完成并可运行。

## 项目结构

```
Omni/
├── docs/                    # 产品规范文档
├── frontend/               # 平台前端（React + TypeScript + Vite + Ant Design）
├── backend/                # 平台后端（FastAPI + Python + SQLAlchemy）
│   └── app/plugins/         # 插件系统
├── scripts/                # 启动脚本
├── cli.py                  # CLI 管理工具
├── docker-compose.yml      # Docker Compose 一键部署
└── tests/                  # 平台级测试（pytest + Playwright）
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + TypeScript + Vite + Ant Design + React Router + Zustand |
| 后端 | FastAPI + Python + SQLAlchemy + Pydantic |
| 数据库 | SQLite（第一阶段） |
| 认证 | Session + Cookie |
| 模块形态 | 工作流型（分析工作台）+ 列表型（对象管理）+ 轻交互型（学习训练） |

## 快速启动

```bash
# 方式一：脚本启动（推荐）
bash scripts/start.sh

# 方式二：手动启动
cd backend && .venv/bin/uvicorn app.main:app --reload --port 3000
cd frontend && npm run dev

# 方式三：Docker Compose
cp .env.example .env
docker-compose up -d
```

**测试账号：** `admin / admin123`

**CLI 工具：**
```bash
python cli.py --help                    # 查看所有命令
python cli.py user create <u> <p>      # 创建用户
python cli.py db status                # 数据库状态
python cli.py server status            # 服务状态
python cli.py session cleanup           # 清理过期会话
```

## 已完成功能

**Phase 1 — 平台骨架 + 样板模块 ✅**
- ✅ 统一登录与会话（Session + Cookie）
- ✅ RBAC 权限体系（admin / user / viewer + 自定义权限）
- ✅ 统一任务中心（全平台耗时操作可追踪）
- ✅ 统一文件中心（模块文件统一管理 + 归档）
- ✅ 统一日志中心（操作审计追溯）
- ✅ 全局搜索（跨任务/文件/日志/模块）
- ✅ 通知中心（分析完成自动推送 + 未读 badge）
- ✅ 平台统计（任务/文件/对象/日志 指标）
- ✅ 备份与恢复（手动打包 ZIP）
- ✅ 帮助中心 + 新手起步引导
- ✅ 模块联动规范（CrossLinkLog + 分析→对象管理联动示例）

**Phase 2 — 部署 + 测试 ✅**
- ✅ Docker Compose 一键部署（后端+前端+PostgreSQL）
- ✅ PostgreSQL 支持（DATABASE_URL 环境变量切换）
- ✅ 自动化测试（10/10 pytest 通过，Playwright 冒烟测试）
- ✅ 配置外置（.env 环境变量）

**Phase 3 — 开发者工具 + API + 插件 ✅**
- ✅ CLI 管理工具（user/db/session/server/module）
- ✅ OpenAPI 文档增强（/docs + /redoc）
- ✅ API 版本管理（/api/v1/ 与 /api/ 完全兼容）
- ✅ Webhook 通知系统（HMAC签名/异步投递/CRUD管理）
- ✅ 插件系统基础架构（PluginManager + 示例插件）

**Phase 4 — 新样板模块 + 实时能力 + 生产加固 ✅**
- ✅ Dashboard 数据仪表盘（统计卡片/7天趋势/模块统计/活动时间线）
- ✅ Schedule 定时任务模块（CRUD + 手动触发）
- ✅ WebSocket 实时通知（/ws 端点 + ConnectionManager）
- ✅ 前端全局状态管理（Zustand: auth/notification/theme stores）
- ✅ 登录页增强（记住用户名 Checkbox）
- ✅ 顶部导航增强（仪表盘入口 + 用户菜单显示角色）

**Phase 5 — 生产加固 + 易用性 ✅**
- ✅ Rate Limiting 中间件（登录5次/分钟，API100次/分钟，localhost白名单）
- ✅ 数据导入/导出模块（JSON格式，GET /export + POST /import）
- ✅ Audit Log 服务（app/services/audit.py，IP/User-Agent记录）
- ✅ 模块注册API（POST /register，GET/PUT /{key}/config，admin only）
- ✅ 对象管理增强（批量删除弹窗确认 + 标签AutoComplete + 分页显示总数）

**样板模块：**
- ✅ 分析工作台（analysis-workbench）— 工作流型
- ✅ 对象管理（record-operations）— 列表型
- ✅ 学习训练（learning-lab）— 轻交互型
- ✅ 数据仪表盘（dashboard-workbench）— 数据展示型
- ✅ 定时调度（schedule-workbench）— 任务调度型

## 开发规范

- `03-统一平台总规范.md` — 平台总体规则
- `04-模块设计规范.md` — 模块接入规范
- `05-AI开发协作规范.md` — AI 开发约束
- `docs/模块联动规范.md` — 模块联动规则

## Git

```bash
git clone https://github.com/1076825449/Omni.git
cd Omni
```

**当前 commit：** `0838588`
**GitHub：** https://github.com/1076825449/Omni
