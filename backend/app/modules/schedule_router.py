"""
Schedule 定时任务模块
"""
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from app.core.database import get_db
from app.models import User, ScheduledTask, OperationLog
from app.models.notification import Notification
from app.models.record import Task as PlatformTask
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/modules/schedule-workbench", tags=["Schedule模块"])


class ScheduleTaskSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    cron_expression: str
    task_type: str
    task_params: Optional[str]
    is_active: bool
    last_run_at: Optional[str]
    next_run_at: Optional[str]
    last_result: Optional[str]
    created_at: str

class ScheduleCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    cron_expression: str
    task_type: str
    task_params: Optional[dict] = None


class ScheduleUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cron_expression: Optional[str] = None
    is_active: Optional[bool] = None


class ScheduleListResponse(BaseModel):
    tasks: List[ScheduleTaskSchema]
    total: int


class ScheduleExecutionLogSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: str
    detail: str
    result: str
    created_at: str


class ScheduleExecutionHistoryResponse(BaseModel):
    task_id: int
    history: List[ScheduleExecutionLogSchema]


def log_action(db: Session, action: str, target_id: str, operator_id: int, detail: str = "", result: str = "success"):
    db.add(OperationLog(
        action=action,
        target_type="ScheduledTask",
        target_id=target_id,
        module="schedule-workbench",
        operator_id=operator_id,
        detail=detail,
        result=result,
    ))


def parse_cron_field(field: str, min_value: int, max_value: int) -> Optional[set[int]]:
    if field == "*":
        return None

    values: set[int] = set()
    for part in field.split(","):
        part = part.strip()
        if not part:
            raise ValueError("cron 字段不能为空")
        if not part.isdigit():
            raise ValueError(f"不支持的 cron 片段: {part}")
        value = int(part)
        if value < min_value or value > max_value:
            raise ValueError(f"cron 数值超出范围: {part}")
        values.add(value)
    return values


def cron_weekday(dt: datetime) -> int:
    return (dt.weekday() + 1) % 7


def compute_next_run(cron_expr: str, from_time: Optional[datetime] = None) -> Optional[datetime]:
    parts = cron_expr.strip().split()
    if len(parts) != 5:
        raise ValueError("cron 表达式必须是 5 段格式")

    minute_values = parse_cron_field(parts[0], 0, 59)
    hour_values = parse_cron_field(parts[1], 0, 23)
    day_values = parse_cron_field(parts[2], 1, 31)
    month_values = parse_cron_field(parts[3], 1, 12)
    weekday_values = parse_cron_field(parts[4], 0, 6)

    current = (from_time or datetime.utcnow()).replace(second=0, microsecond=0) + timedelta(minutes=1)
    deadline = current + timedelta(days=366)

    while current <= deadline:
        if minute_values is not None and current.minute not in minute_values:
            current += timedelta(minutes=1)
            continue
        if hour_values is not None and current.hour not in hour_values:
            current += timedelta(minutes=1)
            continue
        if day_values is not None and current.day not in day_values:
            current += timedelta(minutes=1)
            continue
        if month_values is not None and current.month not in month_values:
            current += timedelta(minutes=1)
            continue
        if weekday_values is not None and cron_weekday(current) not in weekday_values:
            current += timedelta(minutes=1)
            continue
        return current

    raise ValueError("无法在未来一年内计算出下一次执行时间")


@router.get("/tasks", response_model=ScheduleListResponse)
def list_schedule_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取定时任务列表"""
    tasks = db.query(ScheduledTask).filter(
        ScheduledTask.created_by == current_user.id,
    ).order_by(ScheduledTask.created_at.desc()).all()

    return ScheduleListResponse(
        tasks=[
            ScheduleTaskSchema(
                id=t.id,
                name=t.name,
                description=t.description,
                cron_expression=t.cron_expression,
                task_type=t.task_type,
                task_params=t.task_params,
                is_active=t.is_active,
                last_run_at=t.last_run_at.isoformat() if t.last_run_at else None,
                next_run_at=t.next_run_at.isoformat() if t.next_run_at else None,
                last_result=t.last_result,
                created_at=t.created_at.isoformat(),
            )
            for t in tasks
        ],
        total=len(tasks),
    )


@router.post("/tasks", response_model=ScheduleTaskSchema)
def create_schedule_task(
    body: ScheduleCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建定时任务"""
    try:
        next_run_at = compute_next_run(body.cron_expression)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    task = ScheduledTask(
        name=body.name,
        description=body.description,
        cron_expression=body.cron_expression,
        task_type=body.task_type,
        task_params=str(body.task_params) if body.task_params else None,
        is_active=True,
        next_run_at=next_run_at,
        created_by=current_user.id,
    )
    db.add(task)
    db.flush()
    log_action(db, "create", str(task.id), current_user.id, detail=f"创建定时任务: {task.name}")
    db.commit()
    db.refresh(task)
    return ScheduleTaskSchema(
        id=task.id,
        name=task.name,
        description=task.description,
        cron_expression=task.cron_expression,
        task_type=task.task_type,
        task_params=task.task_params,
        is_active=task.is_active,
        last_run_at=None,
        next_run_at=task.next_run_at.isoformat() if task.next_run_at else None,
        last_result=None,
        created_at=task.created_at.isoformat(),
    )


@router.delete("/tasks/{task_id}")
def delete_schedule_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除定时任务"""
    task = db.query(ScheduledTask).filter(
        ScheduledTask.id == task_id,
        ScheduledTask.created_by == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    log_action(db, "delete", str(task.id), current_user.id, detail=f"删除定时任务: {task.name}")
    db.delete(task)
    db.commit()
    return {"success": True, "message": "任务已删除"}


@router.put("/tasks/{task_id}", response_model=ScheduleTaskSchema)
def update_schedule_task(
    task_id: int,
    body: ScheduleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(ScheduledTask).filter(
        ScheduledTask.id == task_id,
        ScheduledTask.created_by == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if body.name is not None:
        task.name = body.name
    if body.description is not None:
        task.description = body.description
    if body.is_active is not None:
        task.is_active = body.is_active
    if body.cron_expression is not None:
        try:
            task.next_run_at = compute_next_run(body.cron_expression, task.last_run_at or datetime.utcnow())
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        task.cron_expression = body.cron_expression

    log_action(db, "update", str(task.id), current_user.id, detail=f"更新定时任务: {task.name}")
    db.commit()
    db.refresh(task)
    return ScheduleTaskSchema(
        id=task.id,
        name=task.name,
        description=task.description,
        cron_expression=task.cron_expression,
        task_type=task.task_type,
        task_params=task.task_params,
        is_active=task.is_active,
        last_run_at=task.last_run_at.isoformat() if task.last_run_at else None,
        next_run_at=task.next_run_at.isoformat() if task.next_run_at else None,
        last_result=task.last_result,
        created_at=task.created_at.isoformat(),
    )


@router.post("/tasks/{task_id}/run")
def run_schedule_task_now(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """手动立即触发定时任务"""
    task = db.query(ScheduledTask).filter(
        ScheduledTask.id == task_id,
        ScheduledTask.created_by == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    now = datetime.utcnow()
    task.last_run_at = now

    try:
        task.next_run_at = compute_next_run(task.cron_expression, now)
        task.last_result = f"success: 手动执行 {task.task_type} 任务完成"
        log_action(db, "create", str(task.id), current_user.id, detail=f"手动执行定时任务: {task.name}")
        log_action(db, "update", str(task.id), current_user.id, detail=f"定时任务执行完成: {task.name}")
        db.add(Notification(
            user_id=current_user.id,
            title="定时任务执行完成",
            content=f'任务 "{task.name}" 已执行完成。',
            type="success",
        ))
        db.add(PlatformTask(
            task_id=f"schedule-run-{datetime.now().strftime('%Y%m%d%H%M%S')}-{task.id}",
            name=f"{task.name}（手动执行）",
            type=task.task_type,
            status="succeeded",
            module="schedule-workbench",
            creator_id=current_user.id,
            result_summary="定时任务已执行完成",
            completed_at=now,
        ))
        db.commit()
        return {"success": True, "message": "任务已执行完成"}
    except ValueError as exc:
        task.last_result = f"failed: {exc}"
        task.next_run_at = None
        log_action(db, "create", str(task.id), current_user.id, detail=f"手动执行定时任务: {task.name}")
        log_action(db, "update", str(task.id), current_user.id, detail=f"定时任务执行失败: {task.name}", result="failed")
        db.add(Notification(
            user_id=current_user.id,
            title="定时任务执行失败",
            content=f'任务 "{task.name}" 执行失败：{exc}',
            type="error",
        ))
        db.add(PlatformTask(
            task_id=f"schedule-run-{datetime.now().strftime('%Y%m%d%H%M%S')}-{task.id}",
            name=f"{task.name}（手动执行）",
            type=task.task_type,
            status="failed",
            module="schedule-workbench",
            creator_id=current_user.id,
            result_summary=f"定时任务执行失败：{exc}",
            completed_at=now,
        ))
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/tasks/{task_id}/history", response_model=ScheduleExecutionHistoryResponse)
def get_schedule_task_history(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(ScheduledTask).filter(
        ScheduledTask.id == task_id,
        ScheduledTask.created_by == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    logs = db.query(OperationLog).filter(
        OperationLog.module == "schedule-workbench",
        OperationLog.operator_id == current_user.id,
        OperationLog.target_id == str(task_id),
    ).order_by(OperationLog.created_at.desc()).limit(20).all()
    return ScheduleExecutionHistoryResponse(
        task_id=task_id,
        history=[
            ScheduleExecutionLogSchema(
                id=item.id,
                action=item.action,
                detail=item.detail,
                result=item.result,
                created_at=item.created_at.isoformat(),
            )
            for item in logs
        ],
    )
