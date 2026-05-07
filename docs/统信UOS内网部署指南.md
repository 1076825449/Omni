# 统信 UOS 1070 内网部署指南

目标：在华为电脑（统信 UOS 1070）上启动前端和后端，局域网内其他电脑通过网址访问，并且必须账号密码登录。

## 1. 准备运行环境

在内网电脑安装：

- Python 3.10 或以上
- Node.js 20 或以上
- Git

查看版本：

```bash
python3 --version
node -v
npm -v
git --version
```

如果系统没有 Node.js，建议使用 NodeSource 或内网离线包安装 Node.js 20。

## 2. 放置项目

建议路径：

```bash
/opt/tax-desktop-app
```

进入项目根目录后准备后端：

```bash
cd /opt/tax-desktop-app/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

准备前端：

```bash
cd /opt/tax-desktop-app/frontend
npm install
```

## 3. 确认内网 IP

在 UOS 电脑执行：

```bash
ip addr
```

找到本机局域网 IP，例如：

```text
192.168.1.50
```

下面命令里的 `192.168.1.50` 替换成你的实际 IP。

## 4. 启动后端

```bash
cd /opt/tax-desktop-app/backend
export SECRET_KEY="请改成一串足够长的随机字符串"
export APP_ENV=production
export AUTH_COOKIE_SECURE=false
export CORS_ORIGINS="http://192.168.1.50:5173,http://localhost:5173,http://127.0.0.1:5173"
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 3000
```

说明：

- `--host 0.0.0.0` 表示允许局域网其他电脑访问。
- 内网 HTTP 部署时 `AUTH_COOKIE_SECURE=false`，否则浏览器不会保存登录 Cookie。
- `CORS_ORIGINS` 必须包含前端访问地址。

## 5. 启动前端

开发/内网试用方式：

```bash
cd /opt/tax-desktop-app/frontend
export VITE_API_BASE_URL="http://192.168.1.50:3000"
npm run dev -- --host 0.0.0.0 --port 5173
```

局域网其他电脑访问：

```text
http://192.168.1.50:5173
```

## 5.1 一键启动脚本

项目已提供 UOS 内网试运行脚本：

```bash
cd /opt/tax-desktop-app
export TAX_ASSISTANT_LAN_IP="192.168.1.50"
export SECRET_KEY="请改成一串足够长的随机字符串"
scripts/uos/start.sh
```

常用命令：

```bash
scripts/uos/healthcheck.sh
scripts/uos/restart.sh
scripts/uos/stop.sh
```

日志位置：

```text
runtime/logs/backend.log
runtime/logs/frontend.log
```

如果希望开机自启动，可参考 `deploy/systemd/` 下的两个服务模板，把其中的 `/opt/tax-desktop-app`、`192.168.1.50`、`SECRET_KEY` 改成实际值后复制到 `/etc/systemd/system/`。

生产预览方式：

```bash
cd /opt/tax-desktop-app/frontend
export VITE_API_BASE_URL="http://192.168.1.50:3000"
npm run build
npm run preview -- --host 0.0.0.0 --port 5173
```

## 6. 创建和管理账号

系统默认管理员账号仍由初始化脚本创建：

```bash
cd /opt/tax-desktop-app/backend
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD="请改成强密码"
.venv/bin/python scripts/seed_user.py
```

登录后进入：

```text
系统设置 -> 账号管理
```

管理员可以：

- 创建账号
- 设置角色：管理员、普通用户、访客
- 启用/停用账号
- 重置密码

普通用户和访客不能创建账号。

## 7. 数据共享口径

系统核心业务数据采用全局共享：

- 纳税人基础信息、数据源导入结果全局共享。
- 管户分配、税收管理员、行业标签、地址标签全局共享。
- 管户记录、风险台账全局共享。
- 案头分析任务、上传资料、分析结果、文书报告全局共享。
- 文书默认信息全局共享。

系统仍会记录实际操作人：

- 登录、导入、分配、修改标签、新增记录、发起分析、导出文书等操作会写入操作日志。
- 管户记录里保留 `created_by`，可追溯是谁新增的记录。
- 案头分析任务保留 `creator_id`，可追溯是谁创建的任务。

## 8. 防火墙放行

如果其他电脑打不开，检查 UOS 防火墙，放行：

- `3000`：后端接口
- `5173`：前端页面

也可以先在同一台机器测试：

```bash
curl http://127.0.0.1:3000/docs
curl http://127.0.0.1:5173
```

再在局域网其他电脑测试：

```text
http://192.168.1.50:5173
```

## 9. 数据迁移建议

迁移前先在当前电脑生成备份：

```text
系统设置 -> 备份中心 -> 发起备份
```

下载备份 ZIP 后拷贝到内网电脑。恢复前务必先停止后端服务，避免数据库正在写入。

内网正式启用前，管理员建议执行一次：

```text
系统设置 -> 数据维护 -> 执行全局数据归并
```

该操作会先自动生成备份，再把早期个人账号下的历史业务数据归并到全局共享空间。归并会保留真实操作人，也会保留人工调整过的行业标签和地址标签。

恢复验收流程：

1. 在备份中心发起备份。
2. 等待备份状态变为“成功”。
3. 下载 ZIP，并确认文件大小不为 0。
4. 在测试目录或备用电脑恢复。
5. 恢复后登录系统，检查首页数据源、信息查询、管户分配、管户记录、案头分析和文书报告。
6. 确认无误后再用于正式内网电脑。

## 10. 启动检查清单

- 后端能访问：`http://192.168.1.50:3000/docs`
- 前端能访问：`http://192.168.1.50:5173`
- 登录后不跳回登录页
- 首页能显示导入历史和业务入口
- 系统设置里能看到“账号管理”
- 系统设置里能看到“数据维护”和“全局操作记录”
- 新建普通用户后可以登录
- 停用用户后不能登录
- 健康检查显示数据库、上传目录、备份和当前数据源状态
- 普通用户不能导入数据源、批量改管理员或批量改标签
