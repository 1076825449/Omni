# Phase 4 任务包

> 说明：本文件为历史任务包，部分内容已完成、部分实现路径已调整。后续开发请不要直接依据本文件判断当前状态，统一以仓库根目录的 `ROADMAP.md` 和 `最终验收清单.md` 为准。

## 目标
扩展样板模块多样性 + 实时能力 + 生产级加固

---

## 任务 29：Dashboard 数据展示模块

### 必须完成
- 新模块：`dashboard-workbench`
- 功能：仪表盘主页 — 展示平台全局统计图表（任务趋势/文件类型分布/模块活跃度）
- 数据来源：复用 `/api/platform/stats/overview` 和 `/api/platform/stats/task-stats`

### 页面设计
- 4个统计卡片（任务总数/完成率/文件总数/活跃模块数）
- 任务趋势折线图（7天）
- 模块任务量柱状图
- 最近活动时间线

### 验收
- 前端 `dashboard-workbench` 页面完整渲染
- 图表使用 Recharts 或 Ant Design Charts

---

## 任务 30：Schedule 定时任务模块

### 必须完成
- 新模块：`schedule-workbench`
- 功能：创建/管理定时任务（cron 表达式）
- 数据模型：`ScheduledTask`（task_id / cron / is_active / last_run / next_run）

### 路由
- `POST /api/modules/schedule-workbench/tasks` — 创建定时任务
- `GET /api/modules/schedule-workbench/tasks` — 列表
- `DELETE /api/modules/schedule-workbench/tasks/{id}` — 删除
- `POST /api/modules/schedule-workbench/tasks/{id}/run` — 手动触发

### 验收
- 可创建 cron 任务
- 持久化到数据库
- 手动触发可执行

---

## 任务 31：WebSocket 实时通知

### 必须完成
- `app/routers/ws.py` — WebSocket 端点 `/ws`
- 认证：Cookie 中的 session_id 验证
- 客户端连接时验证用户身份，断开时清理
- 前端添加 WebSocket 客户端 hook（`useWebSocket`）

### 推送事件
- 任务完成通知
- 新通知到达

### 验收
- WebSocket 连接成功
- 任务完成时自动推送消息到客户端

---

## 任务 32：模块状态管理（Zustand）

### 必须完成
- 前端 `src/stores/` — 全局状态（用户信息/通知数/主题）
- `useUserStore` — 用户信息 + 权限
- `useNotificationStore` — 通知数 + 未读数
- `useThemeStore` — 主题切换（亮/暗）

### 验收
- 状态全局可访问
- 刷新页面状态保持

---

## 任务 33：登录页与首页增强

### 必须完成
- 登录页：添加"记住我"选项
- 首页：根据角色显示不同模块快捷入口
- 顶部导航栏：显示用户名 + 角色 + 通知 badge

### 验收
- 通知 badge 显示未读数
- admin 用户看到管理入口

---

## Git 要求
```
[Phase4-任务29] Dashboard 数据展示模块
[Phase4-任务30] Schedule 定时任务模块
[Phase4-任务31] WebSocket 实时通知
[Phase4-任务32] 前端全局状态管理（Zustand）
[Phase4-任务33] 登录页与首页增强
```
