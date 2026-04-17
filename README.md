# Omni 统一平台

全新统一平台项目，从零开始定义和构建。Phase 1 已完成并可运行。

## 项目结构

```
Omni/
├── docs/                    # 产品规范文档
├── frontend/               # 平台前端（React + TypeScript + Vite + Ant Design）
├── backend/                # 平台后端（FastAPI + Python + SQLAlchemy）
├── scripts/                # 启动脚本
├── data/                   # 本地运行数据（SQLite + 上传文件）
└── tests/                  # 平台级测试
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
# 后端（端口 3000）
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 3000

# 前端（端口 5173）
cd frontend
npm install
npm run dev
```

**测试账号：** `admin / admin123`

## 已完成功能

**平台公共能力：**
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

**样板模块：**
- ✅ 分析工作台（analysis-workbench）— 工作流型
- ✅ 对象管理（record-operations）— 列表型
- ✅ 学习训练（learning-lab）— 轻交互型

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

**当前 commit：** `5c3b2d4`
