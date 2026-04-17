"""
Schedule 定时任务模块
"""
import secrets
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models import User, ScheduledTask
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/modules/schedule-workbench", tags=["Schedule模块"])


class ScheduleTaskSchema(BaseModel):
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

    class Config:
        from_attributes = True


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


def compute_next_run(cron_expr: str, from_time: datetime = None) -> Optional[datetime]:
    """
    简化版 next_run 计算。
    支持格式: \"H H * * *\" (每天)
    支持格式: \"H H * * 0\" (每周)
    支持格式: \"H H 1 * *\" (每月)
    这里仅做演示：每天 9:00
    """
    from datetime import timedelta
    if from_time is None:
        from_time = datetime.utcnow()
    # 简单处理：下次运行 = 明天 9:00 UTC
    tomorrow = from_time.replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=1)
    return tomorrow


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
    task = ScheduledTask(
        name=body.name,
        description=body.description,
        cron_expression=body.cron_expression,
        task_type=body.task_type,
        task_params=str(body.task_params) if body.task_params else None,
        is_active=True,
        next_run_at=compute_next_run(body.cron_expression),
        created_by=current_user.id,
    )
    db.add(task)
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
    db.delete(task)
    db.commit()
    return {"success": True, "message": "任务已删除"}


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

    # 模拟执行：3秒后更新为成功
    import threading

    def execute():
        import time
        time.sleep(3)
        from app.core.database import SessionLocal as SLS
        s = SLS()
        try:
            t = s.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()
            if t:
                t.last_run_at = datetime.utcnow()
                t.next_run_at = compute_next_run(t.cron_expression, datetime.utcnow())
                t.last_result = "success"
                s.commit()
        finally:
            s.close()

    threading.Thread(target=execute, daemon=True).start()
    return {"success": True, "message": "任务已开始执行"}
