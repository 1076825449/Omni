from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models import User
from app.models.record import OperationLog
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/logs", tags=["日志"])


class LogSchema(BaseModel):
    id: int
    action: str
    target_type: str
    target_id: str
    module: str
    operator_id: int
    detail: str
    result: str
    created_at: str

    class Config:
        from_attributes = True


class LogListResponse(BaseModel):
    logs: List[LogSchema]
    total: int


@router.get("", response_model=LogListResponse)
def list_logs(
    action: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    result: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(OperationLog)
    if action:
        q = q.filter(OperationLog.action == action)
    if module:
        q = q.filter(OperationLog.module == module)
    if result:
        q = q.filter(OperationLog.result == result)
    total = q.count()
    logs = q.order_by(OperationLog.created_at.desc()).offset(offset).limit(limit).all()
    return LogListResponse(logs=logs, total=total)
