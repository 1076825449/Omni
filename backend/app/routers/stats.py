from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models import User, Task, FileRecord, OperationLog, Module
from app.models.records import Record
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/platform/stats", tags=["平台公共"])


@router.get("/overview")
def overview_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """平台全局统计数据"""
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
    file_active = db.query(FileRecord).filter(
        FileRecord.owner_id == current_user.id,
        FileRecord.status == "active",
    ).count()

    record_total = db.query(Record).filter(Record.owner_id == current_user.id).count()

    log_total = db.query(OperationLog).filter(OperationLog.operator_id == current_user.id).count()

    module_active = db.query(Module).filter(Module.status == "active", Module.is_active == True).count()

    return {
        "task_total": task_total,
        "task_done": task_done,
        "task_failed": task_failed,
        "task_success_rate": round(task_done / task_total * 100, 1) if task_total > 0 else 0,
        "file_total": file_total,
        "file_active": file_active,
        "record_total": record_total,
        "log_total": log_total,
        "module_active": module_active,
    }


@router.get("/task-stats")
def task_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """各模块任务统计"""
    results = db.query(
        Task.module,
        func.count(Task.id).label("total"),
    ).filter(
        Task.creator_id == current_user.id,
    ).group_by(Task.module).all()

    by_module = {}
    for r in results:
        by_module[r.module] = {"total": r.total}

    for module_key, stats in by_module.items():
        succeeded = db.query(Task).filter(
            Task.creator_id == current_user.id,
            Task.module == module_key,
            Task.status == "succeeded",
        ).count()
        by_module[module_key]["succeeded"] = succeeded

    return by_module


@router.get("/recent-activity")
def recent_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """最近操作日志摘要"""
    logs = db.query(OperationLog).filter(
        OperationLog.operator_id == current_user.id,
    ).order_by(OperationLog.created_at.desc()).limit(10).all()

    return [
        {
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "module": log.module,
            "result": log.result,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]
