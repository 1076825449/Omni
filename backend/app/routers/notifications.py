from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, ConfigDict
from app.core.database import get_db
from app.models import User
from app.models.notification import Notification
from app.routers.auth import get_current_user
import re

router = APIRouter(prefix="/api/notifications", tags=["通知"])


class NotificationSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    type: str
    is_read: bool
    created_at: datetime
    target_url: Optional[str] = None
    target_label: Optional[str] = None

class NotificationListResponse(BaseModel):
    notifications: List[NotificationSchema]
    total: int
    unread_count: int


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    q: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    is_read: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Notification.title.like(like),
                Notification.content.like(like),
            )
        )
    if type:
        query = query.filter(Notification.type == type)
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    total = query.count()
    unread = db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).count()
    notifications = query.order_by(Notification.created_at.desc()).limit(50).all()
    return NotificationListResponse(
        notifications=[
            NotificationSchema(
                id=item.id,
                title=item.title,
                content=item.content,
                type=item.type,
                is_read=item.is_read,
                created_at=item.created_at,
                target_url=resolve_notification_target(item)[0],
                target_label=resolve_notification_target(item)[1],
            )
            for item in notifications
        ],
        total=total,
        unread_count=unread,
    )


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not n:
        return {"success": False, "message": "通知不存在"}
    n.is_read = True
    db.commit()
    return {"success": True}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"success": True, "message": "已全部标为已读"}


def resolve_notification_target(notification: Notification) -> tuple[Optional[str], Optional[str]]:
    if notification.title in {"分析任务完成", "案头分析完成"}:
        match = re.search(r"(?:任务ID|分析编号)[:：]\s*([a-zA-Z0-9\-]+)", notification.content or "")
        if match:
            task_id = match.group(1)
            return f"/modules/analysis-workbench/results/{task_id}", "查看分析结果"
        return "/modules/analysis-workbench/history", "查看分析历史"

    if notification.title == "定时任务执行完成":
        return "/modules/schedule-workbench", "查看定时任务"

    if notification.title == "定时任务执行失败":
        return "/modules/schedule-workbench", "查看定时任务"

    return None, None
