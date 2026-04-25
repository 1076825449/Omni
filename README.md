# Omni 统一平台

当前仓库的唯一执行基线是：

1. `ROADMAP.md`
2. `最终验收清单.md`

在开始任何开发前，后续 agent 必须先阅读这两份文档；如果与旧阶段报告、旧任务包或历史 README 冲突，以上述两份文件为准。

## 当前真实状态

这个项目已经具备统一平台骨架、5 个正式模块、一套可运行的前后端，以及通过验证的当前执行基线。

当前已验证通过的基础项：

- 前端 `npm run build`
- 前端 `npm run lint`
- 后端 `cd backend && .venv/bin/pytest ../tests/backend -q`
- 前端冒烟测试 `cd frontend && npm run test:e2e`
- CLI 基础命令 `python3 cli.py db status`

当前仍明确存在的非阻塞问题：

- 少量模块仍采用轻量内置规则而非外部专业引擎，但当前主流程均已真实接通
- 文档区仍有部分历史材料保留旧说法，仅 `ROADMAP.md` / `最终验收清单.md` 可作为执行和验收依据

## 已纳入的正式模块

- `analysis-workbench`
- `record-operations`
- `learning-lab`
- `dashboard-workbench`
- `schedule-workbench`

平台公共页包括：

- 登录
- 首页
- 模块中心
- 任务中心
- 文件中心
- 日志中心
- 通知中心
- 搜索
- 统计
- 设置
- 帮助

## 本地启动

### 后端

```bash
cd backend
.venv/bin/uvicorn app.main:app --reload --port 3000
```

### 前端

```bash
cd frontend
npm run dev
```

默认访问：

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:3000`

测试账号：

```text
admin / admin123
```

## 常用验证命令

```bash
cd frontend && npm run lint
cd frontend && npm run build
cd backend && .venv/bin/pytest ../tests/backend -q
cd frontend && npm run test:e2e
python3 cli.py db status
```

## 目录说明

```text
backend/      FastAPI 后端
frontend/     React + TypeScript 前端
tests/        pytest 与 Playwright 测试
docs/         历史文档与产品材料
scripts/      启停脚本
cli.py        本地管理命令入口
```

## 说明

如果你要继续推进这个项目，不要从 README 自己猜状态，直接对照：

- [ROADMAP.md](/Volumes/外接硬盘/vibe coding/网站/重做统一平台/ROADMAP.md)
- [最终验收清单.md](/Volumes/外接硬盘/vibe coding/网站/重做统一平台/最终验收清单.md)
