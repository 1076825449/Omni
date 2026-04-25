# Phase 5 任务包

> 说明：本文件为历史任务包，部分内容已完成、部分实现路径已调整。后续开发请不要直接依据本文件判断当前状态，统一以仓库根目录的 `ROADMAP.md` 和 `最终验收清单.md` 为准。

## 目标
生产环境就绪 + 真实场景模块 + 平台易用性提升

---

## 任务 34：Rate Limiting 与 API 安全

### 必须完成
- `app/middleware/rate_limit.py` — 请求频率限制中间件
- 基于 IP + 用户ID 的双重限制
- 限制：登录 5次/分钟 / API 100次/分钟
- 超限返回 `429 Too Many Requests`

### 验收
- 快速连续登录 6 次，第 6 次返回 429
- `/docs` 访问不受限制

---

## 任务 35：数据导出/导入模块

### 必须完成
- 新模块：`data-ops`
- 功能：平台数据的 JSON 导入/导出
- 导出范围：用户（脱敏）/ 角色 / 模块注册信息 / 任务（指定时间范围）/ 文件元数据（不含实际文件）
- 导入：JSON 格式，校验后批量写入

### 路由
- `GET /api/platform/backup/export` — 导出全量数据 JSON
- `POST /api/platform/backup/import` — 导入数据

### 验收
- 导出的 JSON 包含完整结构
- 导入后数据完整

---

## 任务 36：Audit Log 增强

### 必须完成
- 在 `OperationLog` 中记录更多上下文（IP / User-Agent）
- 添加 `log_action` 工具函数到 `app/services/audit.py`
- 登录/登出/权限变更/备份等关键操作记录完整审计日志

### 验收
- 登录日志包含 IP 和 User-Agent
- 所有关键操作都有对应审计记录

---

## 任务 37：对象管理模块增强

### 必须完成
- 添加批量导入（CSV/Excel）
- 添加批量删除（确认对话框）
- 添加标签管理（Tag 输入框 + 自动补全）
- 字段验证完善（必填/格式/长度）

### 验收
- CSV 导入成功
- 批量删除有确认步骤
- 标签可添加/删除

---

## 任务 38：模块注册与配置页面

### 必须完成
- `GET /api/platform/modules` — 获取所有模块列表（已有）
- `POST /api/platform/modules/register` — 注册新模块（需要 admin 权限）
- `GET /api/platform/modules/{key}/config` — 获取模块配置
- `PUT /api/platform/modules/{key}/config` — 更新模块配置

### 验收
- admin 可通过 API 注册新模块
- 模块配置可更新

---

## 任务 39：前端体验优化

### 必须完成
- 加载状态：所有列表页添加 Spin/Skeleton
- 空状态：所有列表页添加空数据提示
- 错误处理：API 错误时显示 message.error 提示
- 表格分页：统一使用 Ant Design Table 的 pagination

### 验收
- 所有列表页有空状态展示
- 操作失败有错误提示

---

## 任务 40：最终验收测试

### 必须完成
- 完整功能走查清单
- 所有 API 端点测试
- Docker Compose 启动验证
- 前后端联调验证

### 验收
- 目标状态是 Phase 1-5 范围内规划能力完成最终走查；是否真的“全部可正常运行”必须以当前仓库根目录的执行与验收基线文档为准
- README 更新最终状态

---

## Git 要求
```
[Phase5-任务34] Rate Limiting 与 API 安全
[Phase5-任务35] 数据导出/导入模块
[Phase5-任务36] Audit Log 增强
[Phase5-任务37] 对象管理模块增强
[Phase5-任务38] 模块注册与配置页面
[Phase5-任务39] 前端体验优化
[Phase5-任务40] 最终验收测试
```
