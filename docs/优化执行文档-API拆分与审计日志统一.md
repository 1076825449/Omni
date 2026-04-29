# 优化执行文档：前端 API 拆分 + 后端审计日志统一

## 0. 文档定位

这份文档是一份**可直接执行的任务书**，交给下一位 agent 实施。

包含两项优化任务：
1. 前端 `services/api.ts`（702 行单文件）拆分为模块化多文件结构
2. 后端 6 个模块路由中的重复审计日志 `log_action` 统一为一个共享服务

**执行前必读：**
- `ROADMAP.md`
- `最终验收清单.md`
- 本文件

**完成后必须通过的质量门：**
```bash
cd frontend && npm run build
cd frontend && npm run lint
cd backend && .venv/bin/pytest ../tests/backend -q
cd frontend && npm run test:e2e
```

---

## 任务一：前端 API 层拆分

### 1.1 背景

当前 `frontend/src/services/api.ts` 是 702 行的单文件，包含：
- HTTP 客户端（`request<T>`、`requestText`、`API_BASE`）
- 20+ 个 TypeScript 接口/类型
- 10 个 API 对象（`modulesApi`、`tasksApi`、`filesApi`、...）

问题：改任何一个模块的接口都要翻整个文件，加新模块也只能往后追加。

### 1.2 目标文件结构

```
frontend/src/services/
├── api/
│   ├── client.ts          # 通用 HTTP 客户端
│   ├── auth.ts            # authApi
│   ├── platform.ts        # modulesApi, tasksApi, filesApi, logsApi,
│   │                      # backupApi, rolesApi, notificationsApi, searchApi, platformStatsApi
│   ├── analysis.ts        # analysisApi + AnalysisTask, AnalysisTaskDetail, AnalysisRisk,
│   │                      # TaxpayerProfile, UploadProfile, TaskCreatedResponse
│   ├── records.ts         # recordsApi + RecordItem, RecordRelationLog, RecordRelationFile, RecordRelations
│   ├── info-query.ts      # infoQueryApi（TaxpayerProfile 从 analysis.ts re-export）
│   ├── risk-ledger.ts     # riskLedgerApi + RiskDossier, RiskLedgerEntry, RiskLedgerStats, RiskLedgerBatchResult
│   ├── learning-lab.ts    # learningLabApi + TrainingSet, PracticeSession, Question, FavoriteItem, LearningStats
│   ├── dashboard.ts       # dashboardApi + DashboardData
│   ├── schedule.ts        # scheduleApi + ScheduleTask, ScheduleExecutionLog
│   └── index.ts           # barrel re-export 所有 api 对象和类型
└── api.ts                 # 只保留一行：export * from './api/index'（向后兼容）
```

### 1.3 具体步骤

#### 步骤 1：创建 `frontend/src/services/api/client.ts`

```typescript
const DEFAULT_API_HOST =
  typeof window !== 'undefined' && window.location?.hostname
    ? window.location.hostname
    : '127.0.0.1'

export const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${DEFAULT_API_HOST}:3000`

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function requestText(path: string, options?: RequestInit): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}
```

#### 步骤 2：按模块拆分

每个文件的固定头部：
```typescript
import { request, requestText, API_BASE } from './client'
// 根据需要选择导入 request / requestText / API_BASE
```

**拆分对照表（原文件行号 → 目标文件）：**

| 原文件行号 | 内容 | 目标文件 |
|-----------|------|---------|
| 1-31 | `API_BASE`, `request`, `requestText` | `client.ts` |
| 33-43 | `Module` 接口 | `platform.ts` |
| 45-65 | `Task`, `TaskDetail` 接口 | `platform.ts` |
| 67-98 | `FileRecord`, `FilePreview`, `OperationLog` 接口 | `platform.ts` |
| 101-145 | `modulesApi`, `tasksApi`, `filesApi`, `logsApi` | `platform.ts` |
| 147-156 | `authApi` | `auth.ts` |
| 158-245 | `AnalysisTask` ... `TaskCreatedResponse` | `analysis.ts` |
| 247-264 | `BackupRecord`, `backupApi` | `platform.ts` |
| 266-308 | `analysisApi` | `analysis.ts` |
| 310-327 | `RoleRecord`, `rolesApi` | `platform.ts` |
| 329-390 | `NotificationRecord` ... `platformStatsApi` | `platform.ts` |
| 392-470 | `RecordItem` ... `recordsApi` | `records.ts` |
| 472-496 | `infoQueryApi` | `info-query.ts` |
| 498-586 | `RiskDossier` ... `riskLedgerApi` | `risk-ledger.ts` |
| 588-658 | `TrainingSet` ... `learningLabApi` | `learning-lab.ts` |
| 660-671 | `DashboardData`, `dashboardApi` | `dashboard.ts` |
| 673-702 | `ScheduleTask` ... `scheduleApi` | `schedule.ts` |

**共享类型注意事项：**
- `TaxpayerProfile` 在 `analysis.ts` 和 `info-query.ts` 都用到。定义在 `analysis.ts`，在 `info-query.ts` 中 re-export：
```typescript
// info-query.ts
import { TaxpayerProfile } from './analysis'
export type { TaxpayerProfile }
```

#### 步骤 3：创建 `frontend/src/services/api/index.ts`

```typescript
export { API_BASE, request, requestText } from './client'
export * from './auth'
export * from './platform'
export * from './analysis'
export * from './records'
export * from './info-query'
export * from './risk-ledger'
export * from './learning-lab'
export * from './dashboard'
export * from './schedule'
```

#### 步骤 4：修改原 `frontend/src/services/api.ts`

将原有 702 行内容替换为：

```typescript
export * from './api/index'
```

这样所有已存在的 `import { xxx } from '@/services/api'` 或 `import { xxx } from '../services/api'` 都不会 break。

#### 步骤 5：验证

```bash
cd frontend && npm run build   # 必须通过
cd frontend && npm run lint    # 必须通过
```

如果 lint 报错 `no-restricted-imports` 或路径问题，逐一修复。

### 1.4 禁止事项

- **不改任何接口签名**
- **不改任何函数名**
- **不改任何导出名称**
- **不移动 `stores/` 里对 api 的调用方式**
- 只做文件组织变更，外部行为完全不变

---

## 任务二：后端审计日志统一

### 2.1 背景

当前 6 个模块路由文件各自定义了私有 `log_action()` 函数：

| 文件 | 私有函数位置 | 调用次数 |
|------|------------|---------|
| `backend/app/modules/analysis_router.py` | 第 127 行 | ~8 次 |
| `backend/app/modules/records_router.py` | 第 20 行 | ~7 次 |
| `backend/app/modules/learning_lab_router.py` | 第 20 行 | ~4 次 |
| `backend/app/modules/schedule_router.py` | 第 69 行 | ~5 次 |
| `backend/app/modules/info_query_router.py` | 第 166 行 | ~2 次 |
| `backend/app/modules/risk_ledger_router.py` | 第 168 行 | ~3 次 |

已有的 `backend/app/services/audit.py` 完全没被使用，且存在设计问题（内部 commit、target_type 与 module 混淆）。

### 2.2 当前各模块 log_action 签名对比

```
analysis:     log_action(db, action, target_id, operator_id, module="analysis-workbench", detail="", result="success")
records:      log_action(db, action, target_id, operator_id, detail="", result="success")
learning_lab: log_action(db, action, target_id, operator_id, detail="")  # result 硬编码 "success"
schedule:     log_action(db, action, target_id, operator_id, detail="", result="success")
info_query:   log_action(db, action, target_id, operator_id, detail)      # result 硬编码 "success"，detail 必填
risk_ledger:  log_action(db, action, target_id, operator_id, detail)      # result 硬编码 "success"，detail 必填
```

各模块硬编码的 `target_type` 和 `module`：

| 模块文件 | target_type | module |
|---------|-------------|--------|
| analysis_router | `"Task"` | `"analysis-workbench"` |
| records_router | `"Record"` | `"record-operations"` |
| learning_lab_router | `"LearningLab"` | `"learning-lab"` |
| schedule_router | `"ScheduledTask"` | `"schedule-workbench"` |
| info_query_router | `"TaxpayerInfo"` | `"info-query"` |
| risk_ledger_router | `"RiskLedger"` | `"risk-ledger"` |

### 2.3 新版统一接口

完全重写 `backend/app/services/audit.py`：

```python
"""
统一审计日志服务
所有模块共用，不控制事务（由调用方 commit）
"""
from sqlalchemy.orm import Session
from app.models.record import OperationLog


def log_operation(
    db: Session,
    *,
    action: str,
    target_type: str,
    target_id: str,
    module: str,
    operator_id: int,
    detail: str = "",
    result: str = "success",
) -> OperationLog:
    """
    记录一条操作审计日志。

    参数说明:
    - action: 操作动词 (create / update / delete / import / start / complete / favorite / run / cancel / rerun)
    - target_type: 目标对象类型 (Task / Record / ScheduledTask / RiskLedger / TaxpayerInfo / LearningLab)
    - target_id: 目标对象 ID
    - module: 所属模块 key (analysis-workbench / record-operations / learning-lab / schedule-workbench / info-query / risk-ledger)
    - operator_id: 操作人 user.id
    - detail: 描述文本（可选）
    - result: 操作结果 ("success" / "failed")

    注意:
    - 本函数只 db.add()，不 commit()
    - 调用方负责在合适时机 commit
    """
    log = OperationLog(
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        module=module,
        operator_id=operator_id,
        detail=detail,
        result=result,
    )
    db.add(log)
    return log
```

### 2.4 各模块替换步骤

对每个模块执行以下操作：

#### 通用操作

1. 在文件顶部添加导入：
```python
from app.services.audit import log_operation
```

2. 删除文件中的私有 `def log_action(...)` 函数定义

3. 将所有 `log_action(...)` 调用替换为 `log_operation(...)`，使用命名参数

#### 具体替换映射

**`analysis_router.py`**

旧调用：
```python
log_action(db, "create", task.task_id, user.id, detail=f"创建分析任务: {name}")
```
新调用：
```python
log_operation(db, action="create", target_type="Task", target_id=task.task_id,
              module="analysis-workbench", operator_id=user.id, detail=f"创建分析任务: {name}")
```

**`records_router.py`**

旧调用：
```python
log_action(db, "create", record.record_id, user.id, detail=f"新建对象: {data.name}")
```
新调用：
```python
log_operation(db, action="create", target_type="Record", target_id=record.record_id,
              module="record-operations", operator_id=user.id, detail=f"新建对象: {data.name}")
```

**`learning_lab_router.py`**

旧调用（无 result 参数，硬编码 success）：
```python
log_action(db, "start", session.session_id, user.id, detail=f"开始练习: {set_name}")
```
新调用：
```python
log_operation(db, action="start", target_type="LearningLab", target_id=session.session_id,
              module="learning-lab", operator_id=user.id, detail=f"开始练习: {set_name}")
```

**`schedule_router.py`**

旧调用：
```python
log_action(db, "create", str(task.id), user.id, detail=f"创建定时任务: {data.name}")
```
新调用：
```python
log_operation(db, action="create", target_type="ScheduledTask", target_id=str(task.id),
              module="schedule-workbench", operator_id=user.id, detail=f"创建定时任务: {data.name}")
```

**`info_query_router.py`**

旧调用（detail 是必填位置参数）：
```python
log_action(db, "import", batch_id, user.id, f"导入纳税人信息: {imported}条")
```
新调用：
```python
log_operation(db, action="import", target_type="TaxpayerInfo", target_id=batch_id,
              module="info-query", operator_id=user.id, detail=f"导入纳税人信息: {imported}条")
```

**`risk_ledger_router.py`**

旧调用：
```python
log_action(db, "create", entry.entry_id, user.id, f"新增台账记录: {data.taxpayer_id}")
```
新调用：
```python
log_operation(db, action="create", target_type="RiskLedger", target_id=entry.entry_id,
              module="risk-ledger", operator_id=user.id, detail=f"新增台账记录: {data.taxpayer_id}")
```

### 2.5 边界情况处理

1. **`analysis_router.py` 有调用使用了 `result="failed"`**：保持不变，新接口支持 `result` 参数。
2. **`schedule_router.py` 有调用使用了 `result="failed"`**：同上。
3. **`records_router.py` 有调用使用了 `result="failed"`**：同上。
4. **其他模块原来硬编码 `result="success"`**：不传 `result` 参数即可，默认就是 `"success"`。
5. **`analysis_router.py` 的 `log_action` 有一个额外的 `module` 参数**（默认值 `"analysis-workbench"`）：所有调用点都使用默认值，替换时统一写 `module="analysis-workbench"` 即可。

### 2.6 验证

```bash
cd backend && .venv/bin/pytest ../tests/backend -q   # 必须全部通过
cd frontend && npm run test:e2e                       # 必须通过（确保日志功能不回归）
```

额外手动验证建议：
- 启动后端，执行一次分析任务，检查 `/api/logs` 是否正常返回日志
- 在对象管理模块新建一条记录，检查日志是否正常写入

### 2.7 禁止事项

- **不改 `OperationLog` 模型字段**（不加 ip/user_agent 列，这是后续增强项）
- **不改 log 的 commit 时机**（保持由调用方控制事务）
- **不改已有的 action 动词**（保持现有：create/update/delete/import/start/complete/favorite/run/cancel/rerun）
- **不改 `routers/` 下的平台级路由**（本次只处理 `modules/` 下的 6 个文件）
- **不引入装饰器语法**（经分析，各调用点的 target_id 来源各不相同，装饰器反而增加复杂度；命名参数函数调用更清晰）

---

## 执行顺序建议

1. **先做任务一**（前端 API 拆分）—— 改动范围大但风险低，完成后立即验证 build/lint
2. **再做任务二**（后端审计统一）—— 涉及后端业务逻辑，需要更仔细地逐文件确认

## 完成标准

两项任务完成后，必须同时满足：

- [ ] `cd frontend && npm run build` 通过
- [ ] `cd frontend && npm run lint` 通过
- [ ] `cd backend && .venv/bin/pytest ../tests/backend -q` 通过
- [ ] `cd frontend && npm run test:e2e` 通过
- [ ] 前端所有现有 `import { xxx } from '...services/api'` 路径不需要修改
- [ ] 后端 `modules/` 下 6 个文件不再有私有 `log_action` 函数
- [ ] `backend/app/services/audit.py` 是唯一的审计日志入口
- [ ] 没有引入新的依赖包

## 完成后的输出要求

按 ROADMAP.md 要求，完成后必须说明：

1. 本次目标
2. 本次实际改动
3. 影响的页面、接口、脚本或流程
4. 如何验证
5. 哪些旧能力保持不变
6. 仍未解决的问题
7. 是否可进入下一任务
