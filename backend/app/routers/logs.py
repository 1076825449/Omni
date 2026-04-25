from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, ConfigDict
from app.core.database import get_db
from app.models import User
from app.models.record import OperationLog
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/logs", tags=["日志"])


class LogSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: str
    target_type: str
    target_id: str
    module: str
    operator_id: int
    detail: str
    result: str
    created_at: datetime

class LogListResponse(BaseModel):
    logs: List[LogSchema]
    total: int


@router.get("", response_model=LogListResponse)
def list_logs(
    q: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    result: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(OperationLog).filter(OperationLog.operator_id == current_user.id)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                OperationLog.detail.like(like),
                OperationLog.target_type.like(like),
                OperationLog.target_id.like(like),
            )
        )
    if action:
        query = query.filter(OperationLog.action == action)
    if module:
        query = query.filter(OperationLog.module == module)
    if result:
        query = query.filter(OperationLog.result == result)
    total = query.count()
    logs = query.order_by(OperationLog.created_at.desc()).offset(offset).limit(limit).all()
    return LogListResponse(logs=logs, total=total)
