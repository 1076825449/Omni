# Phase 3 任务包

> 说明：本文件为历史任务包，部分内容已完成、部分实现路径已调整。后续开发请不要直接依据本文件判断当前状态，统一以仓库根目录的 `ROADMAP.md` 和 `最终验收清单.md` 为准。

## 目标
开发者工具 + API 开放 + 插件系统基础

---

## 任务 24：CLI 开发者工具

### 必须完成
- `cli.py` — Omni 平台的命令行管理工具
- 功能：创建用户 / 重置密码 / 查看状态 / 初始化数据库 / 清理会话

### CLI 命令设计
```bash
python cli.py user create <username> <password> [--role admin|user|viewer]
python cli.py user reset-password <username> <new_password>
python cli.py db init              # 初始化数据库表
python cli.py db status           # 查看数据库状态
python cli.py session cleanup      # 清理过期会话
python cli.py server status        # 检查后端服务是否运行
python cli.py server restart       # 重启后端服务
```

### 验收
- `python cli.py --help` 显示所有命令
- `python cli.py user create test test123` 可创建用户
- `python cli.py db init` 可初始化全部表

---

## 任务 25：OpenAPI 文档增强

### 必须完成
- 后端 `/docs` (Swagger UI) 和 `/redoc` 已有，检查是否完整
- 所有 endpoint 添加 docstring
- 所有 schema 添加 docstring
- 添加 `info` 版本和描述

### 验收
- `/docs` 显示完整的 API 文档
- 每个 endpoint 有中文说明

---

## 任务 26：API 版本管理

### 必须完成
- 现有 API 添加 `/api/v1` 前缀版本
- 当前全部路由保持兼容，同时支持 `/api/` 和 `/api/v1/`
- 添加 API 版本声明

### 验收
- `curl http://localhost:3000/api/v1/auth/me` 正常工作
- `curl http://localhost:3000/api/auth/me` 正常工作

---

## 任务 27：Webhook 通知系统（插件基础）

### 必须完成
- `WebhookTrigger` 模型 — 支持配置外部 URL
- 触发事件：`task.completed` / `analysis.done` / `file.uploaded`
- POST 事件到配置的 URL，携带 JSON payload
- 支持签名验证（HMAC-SHA256）

### 验收
- 可通过 API/CLI 添加 webhook URL
- 任务完成时自动 POST 到 webhook URL
- 签名正确可验证

---

## 任务 28：插件系统基础架构

### 必须完成
- `app/plugins/` 目录结构
- `PluginManager` — 发现/加载/卸载插件
- `PluginInterface` — 定义插件必须实现的接口
- 示例插件：`hello_plugin.py`

### 验收
- `PluginManager.load_all()` 可加载 `plugins/` 目录下的插件
- 插件可声明 `name`, `version`, `on_task_completed` 等钩子
- 钩子触发时自动调用所有插件的对应方法

---

## Git 要求

每个任务单独 commit：
```
[Phase3-任务24] CLI 开发者工具
[Phase3-任务25] OpenAPI 文档增强
[Phase3-任务26] API 版本管理
[Phase3-任务27] Webhook 通知系统
[Phase3-任务28] 插件系统基础架构
```
