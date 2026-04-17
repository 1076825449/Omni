# Omni 统一平台

全新统一平台项目，从零开始定义和构建。

## 项目结构

```
Omni/
├── docs/                    # 产品规范文档（*.md 文件）
├── frontend/               # 平台前端（React + TypeScript + Vite）
├── backend/                # 平台后端（FastAPI + Python）
├── scripts/                # 启动、停止、检查脚本
├── data/                   # 本地运行数据（SQLite / 上传文件）
└── tests/                  # 平台级测试
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + TypeScript + Vite + Ant Design + React Router + Zustand |
| 后端 | FastAPI + Python + SQLAlchemy + Pydantic |
| 数据库 | SQLite（第一阶段）→ PostgreSQL（后续） |
| 认证 | Session + Cookie |
| 测试 | pytest + Playwright |

## 快速启动

```bash
# 前端
cd frontend && npm install && npm run dev

# 后端
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn sqlalchemy pydantic
uvicorn app.main:app --reload --port 3000
```

## 开发规范

所有开发必须遵守以下规范文档：

- `03-统一平台总规范.md` — 平台总体规则
- `04-模块设计规范.md` — 模块接入规范
- `05-AI开发协作规范.md` — AI 开发约束
- `11-Git提交规范.md` — Git 提交规则
- `12-Minimax约束指令.md` — AI 执行约束

## 任务包（按顺序执行）

| 编号 | 任务 | 状态 |
|---|---|---|
| 00 | 总执行规则 | ✅ 确认 |
| 01 | 项目初始化与文档落位 | 🚧 进行中 |
| 02 | 平台信息架构与页面清单 | ⏳ |
| 03 | 平台视觉基线与设计系统 | ⏳ |
| 04 | 平台骨架前端实现 | ⏳ |
| 05 | 登录与会话基础 | ⏳ |
| ... | ... | ⏳ |

## Git 提交规则

每次任务完成后必须 Git 提交，提交信息格式：

```
[任务XX] 简短描述：本次完成了什么
```

详见：`11-Git提交规范.md`
