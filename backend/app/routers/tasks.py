from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models import Task, User
from app.models.record import Task as TaskModel
from app.routers.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/api/tasks", tags=["任务"])


class TaskSchema(BaseModel):
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

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    tasks: List[TaskSchema]
    total: int


@router.get("", response_model=TaskListResponse)
def list_tasks(
    status: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    type_: Optional[str] = Query(None, alias="type"),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取任务列表。支持按状态/模块/类型筛选，分页返回。"""
    q = db.query(TaskModel)
    if status:
        q = q.filter(TaskModel.status == status)
    if module:
        q = q.filter(TaskModel.module == module)
    if type_:
        q = q.filter(TaskModel.type == type_)
    total = q.count()
    tasks = q.order_by(TaskModel.created_at.desc()).offset(offset).limit(limit).all()
    return TaskListResponse(tasks=tasks, total=total)
