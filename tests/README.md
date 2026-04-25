# Omni 平台测试说明

本目录记录当前仓库可直接复现的测试入口与覆盖范围。

如果 `tests/README.md` 与仓库根目录的 `ROADMAP.md`、`最终验收清单.md`、`当前真实状态.md` 冲突，以根目录基线文档为准。

## 当前可直接运行的命令

### 后端测试

```bash
cd backend && .venv/bin/pytest ../tests/backend -q
```

说明：
- 使用仓库内现成的 `backend/.venv`
- 当前后端测试集中在 [tests/backend/test_api.py](/Volumes/外接硬盘/vibe coding/网站/重做统一平台/tests/backend/test_api.py)
- 最近一次实测结果：`19 passed`

### 前端冒烟测试

```bash
cd frontend && npm run test:e2e
```

说明：
- Playwright 配置文件为 [tests/frontend/playwright.config.ts](/Volumes/外接硬盘/vibe coding/网站/重做统一平台/tests/frontend/playwright.config.ts)
- 默认 `baseURL` 为 `http://127.0.0.1:5173`
- 也可以通过环境变量覆盖：

```bash
E2E_BASE_URL=http://127.0.0.1:4173 cd frontend && npm run test:e2e
```

### 前端质量门

```bash
cd frontend && npm run lint
cd frontend && npm run build
```

## 当前覆盖范围

### 后端

- 认证登录
- 任务、文件、通知、统计基础接口
- `analysis-workbench` 创建、上传、运行、导出报告
- `analysis-workbench` 基于上传文件内容生成轻量摘要与对象结果
- 分析完成后的文件、日志、通知、对象联动、搜索回读
- `record-operations` 导入、`batch` 过滤、关键搜索回读
- `record-operations` 标签过滤、标签建议、标签更新
- `learning-lab` 开始练习、答题完成、收藏、统计闭环
- `learning-lab` 题库与训练集配置已文件化，测试按配置后的题量校验
- `dashboard-workbench` 概览数据回读
- `schedule-workbench` 合法/非法 cron、更新回读、手动执行后的状态与日志更新

### 前端 smoke

- 登录
- 首页
- 设置页
- `analysis-workbench` 关键流程入口
- `record-operations` 工作台与列表入口
- `learning-lab` 训练集入口
- `dashboard-workbench` 模块入口
- `schedule-workbench` 创建任务入口

## 执行前提

- 后端服务默认运行在 `http://127.0.0.1:3000`
- 前端服务默认运行在 `http://127.0.0.1:5173`
- 默认测试账号：`admin / admin123`

## 建议执行顺序

```bash
cd frontend && npm run lint
cd frontend && npm run build
cd backend && .venv/bin/pytest ../tests/backend -q
cd frontend && npm run test:e2e
```
