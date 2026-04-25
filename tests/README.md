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
- **最近一次实测结果：`36 passed`**
- 测试覆盖：登录、权限差异、模块接口、任务中心、文件中心、日志中心、通知中心、搜索、统计、备份、7个正式模块核心接口

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

### 后端 pytest（36项）

- **认证**：登录成功/失败、未登录拒绝
- **权限体系**：admin/user/viewer 角色差异、权限校验
  - viewer 不能注册模块、创建备份、修改角色
  - user 不能访问平台管理端点
  - 备份创建需要 `platform:backup:create` 权限
  - 文件归档需要 `platform:file:operate` 权限
  - 备份恢复需要 admin 角色
- **模块列表**：7个正式模块返回
- **任务中心**：列表、详情、关联文件/日志/对象
- **文件中心**：上传、预览(XLSX/CSV)、归档、下载、筛选
- **日志中心**：关键操作日志写入、按action筛选
- **通知中心**：创建、未读数、单条已读、全部已读、is_read筛选、target_url
- **搜索**：跨表搜索
- **统计**：概览数据
- **备份导出**：backup export 接口、JSON内容校验
- **7个正式模块核心接口**：
  - `analysis-workbench`：创建、上传、运行、导出报告、风险复核、重跑
  - `record-operations`：导入、batch过滤、标签更新
  - `info-query`：纳税人导入、字段别名、查询、统计
  - `risk-ledger`：单户记录、批量导入、筛选、备份导出
  - `learning-lab`：练习流程、收藏、统计
  - `dashboard-workbench`：概览数据
  - `schedule-workbench`：合法/非法cron、创建、更新、启停、执行、历史

### 前端 Playwright smoke（1项覆盖7模块）

- 登录
- 首页
- 模块中心（7个模块入口）
- `analysis-workbench`：新建、上传、执行、结果页、历史页
- `record-operations`：工作台、列表、新建对象
- `risk-ledger`：单户记录、批量记录
- `info-query`：信息查询
- `learning-lab`：训练集、开始练习
- `dashboard-workbench`：平台联动、最近活动
- `schedule-workbench`：创建定时任务
- 设置页

## 执行前提

- 后端服务默认运行在 `http://127.0.0.1:3000`
- 前端服务默认运行在 `http://127.0.0.1:5173`
- 默认测试账号：`admin / admin123`

## 常见失败原因和处理方式

1. **后端服务未启动**：`cd backend && .venv/bin/uvicorn app.main:app --reload --port 3000`
2. **前端服务未启动**：`cd frontend && npm run dev`
3. **pytest 数据库锁定**：确保没有其他进程占用 `data/omni.db`
4. **Playwright 找不到浏览器**：`cd frontend && npx playwright install`
5. **Session 过期**：重新登录或重启服务

## 建议执行顺序

```bash
# 1. 前端质量门
cd frontend && npm run lint
cd frontend && npm run build

# 2. 后端测试（确保后端服务在 3000 端口运行）
cd backend && .venv/bin/pytest ../tests/backend -q

# 3. 前端 e2e（确保前端服务在 5173 端口运行）
cd frontend && npm run test:e2e
```
