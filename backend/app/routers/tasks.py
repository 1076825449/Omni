from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, ConfigDict
from app.core.database import get_db
from app.models import User
from app.models.record import Task as TaskModel
from app.models.record import FileRecord, OperationLog
from app.models.records import Record
from app.routers.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/api/tasks", tags=["任务"])


class TaskSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: str
    name: str
    type: str
    status: str
    module: str
    creator_id: int
    result_summary: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

class TaskListResponse(BaseModel):
    tasks: List[TaskSchema]
    total: int


class TaskDetailResponse(TaskSchema):
    file_count: int = 0
    log_count: int = 0
    related_record_count: int = 0
    source_url: Optional[str] = None
    source_label: Optional[str] = None


def resolve_task_source(task: TaskModel) -> tuple[Optional[str], Optional[str]]:
    if task.module == "analysis-workbench":
        return f"/modules/analysis-workbench/results/{task.task_id}", "查看分析结果"
    if task.module == "schedule-workbench":
        return "/modules/schedule-workbench", "查看定时任务"
    if task.module == "record-operations":
        return "/modules/record-operations/list", "查看对象列表"
    if task.module == "learning-lab":
        return "/modules/learning-lab", "查看学习训练"
    if task.module == "dashboard-workbench":
        return "/modules/dashboard-workbench", "查看平台总览"
    return f"/modules/{task.module}", "查看来源模块"


@router.get("", response_model=TaskListResponse)
def list_tasks(
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    type_: Optional[str] = Query(None, alias="type"),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取任务列表。支持按状态/模块/类型筛选，分页返回。"""
    query = db.query(TaskModel).filter(TaskModel.creator_id == current_user.id)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                TaskModel.name.like(like),
                TaskModel.task_id.like(like),
                TaskModel.result_summary.like(like),
            )
        )
    if status:
        query = query.filter(TaskModel.status == status)
    if module:
        query = query.filter(TaskModel.module == module)
    if type_:
        query = query.filter(TaskModel.type == type_)
    total = query.count()
    tasks = query.order_by(TaskModel.created_at.desc()).offset(offset).limit(limit).all()
    return TaskListResponse(tasks=tasks, total=total)


@router.get("/{task_id}", response_model=TaskDetailResponse)
def get_task_detail(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(TaskModel).filter(
        TaskModel.task_id == task_id,
        TaskModel.creator_id == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    file_count = 0
    related_record_count = 0
    if task.module == "analysis-workbench":
        file_count = db.query(FileRecord).filter(
            FileRecord.owner_id == current_user.id,
            FileRecord.module == task.module,
            FileRecord.name.like(f"{task.task_id}%"),
        ).count()
        related_record_count = db.query(Record).filter(
            Record.owner_id == current_user.id,
            Record.import_batch == f"analysis-{task.task_id}",
        ).count()

    log_count = db.query(OperationLog).filter(
        OperationLog.operator_id == current_user.id,
        OperationLog.module == task.module,
        OperationLog.target_id == task.task_id,
    ).count()
    source_url, source_label = resolve_task_source(task)

    return TaskDetailResponse(
        id=task.id,
        task_id=task.task_id,
        name=task.name,
        type=task.type,
        status=task.status,
        module=task.module,
        creator_id=task.creator_id,
        result_summary=task.result_summary,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
        file_count=file_count,
        log_count=log_count,
        related_record_count=related_record_count,
        source_url=source_url,
        source_label=source_label,
    )
