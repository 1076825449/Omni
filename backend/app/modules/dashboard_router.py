"""
Dashboard 模块 — 平台数据仪表盘
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models import User
from app.models.record import Task, FileRecord, OperationLog
from app.models.module import Module
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/modules/dashboard", tags=["Dashboard模块"])


class StatCard(BaseModel):
    label: str
    value: int
    change: float = 0  # 相比上周期变化百分比


class TaskTrendPoint(BaseModel):
    date: str
    count: int


class ModuleTaskStat(BaseModel):
    module: str
    total: int
    succeeded: int
    failed: int


class RecentActivity(BaseModel):
    action: str
    target_type: str
    detail: str
    module: str
    result: str
    created_at: str


class DashboardResponse(BaseModel):
    stat_cards: List[StatCard]
    task_trend: List[TaskTrendPoint]
    module_stats: List[ModuleTaskStat]
    recent_activity: List[RecentActivity]


@router.get("/overview", response_model=DashboardResponse)
def dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """平台全局仪表盘数据"""

    # 统计卡片
    task_total = db.query(Task).filter(Task.creator_id == current_user.id).count()
    task_done = db.query(Task).filter(
        Task.creator_id == current_user.id,
        Task.status == "succeeded",
    ).count()
    task_failed = db.query(Task).filter(
        Task.creator_id == current_user.id,
        Task.status == "failed",
    ).count()
    file_total = db.query(FileRecord).filter(FileRecord.owner_id == current_user.id).count()
    module_active = db.query(Module).filter(
        Module.is_active == True,
        Module.status == "active",
    ).count()

    success_rate = round(task_done / task_total * 100, 1) if task_total > 0 else 0

    stat_cards = [
        StatCard(label="任务总数", value=task_total),
        StatCard(label="任务完成率", value=task_done, change=success_rate),
        StatCard(label="文件总数", value=file_total),
        StatCard(label="活跃模块", value=module_active),
    ]

    # 7天任务趋势
    task_trend = []
    today = datetime.utcnow().date()
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        count = db.query(Task).filter(
            Task.creator_id == current_user.id,
            func.date(Task.created_at) == day,
        ).count()
        task_trend.append(TaskTrendPoint(
            date=day.strftime("%m-%d"),
            count=count,
        ))

    # 各模块任务统计
    module_stats_raw = db.query(
        Task.module,
        func.count(Task.id).label("total"),
    ).filter(
        Task.creator_id == current_user.id,
    ).group_by(Task.module).all()

    module_stats = []
    for r in module_stats_raw:
        succeeded = db.query(Task).filter(
            Task.creator_id == current_user.id,
            Task.module == r.module,
            Task.status == "succeeded",
        ).count()
        failed = db.query(Task).filter(
            Task.creator_id == current_user.id,
            Task.module == r.module,
            Task.status == "failed",
        ).count()
        module_stats.append(ModuleTaskStat(
            module=r.module,
            total=r.total,
            succeeded=succeeded,
            failed=failed,
        ))

    # 最近活动
    logs = db.query(OperationLog).filter(
        OperationLog.operator_id == current_user.id,
    ).order_by(OperationLog.created_at.desc()).limit(8).all()

    recent_activity = [
        RecentActivity(
            action=log.action,
            target_type=log.target_type or "",
            detail=log.detail or "",
            module=log.module or "",
            result=log.result or "",
            created_at=log.created_at.isoformat() if log.created_at else "",
        )
        for log in logs
    ]

    return DashboardResponse(
        stat_cards=stat_cards,
        task_trend=task_trend,
        module_stats=module_stats,
        recent_activity=recent_activity,
    )
