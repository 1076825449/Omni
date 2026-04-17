from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models import User
from app.models.notification import Notification
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["通知"])


class NotificationSchema(BaseModel):
    id: int
    title: str
    content: str
    type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationSchema]
    total: int
    unread_count: int


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    total = q.count()
    unread = q.filter(Notification.is_read == False).count()
    notifications = q.order_by(Notification.created_at.desc()).limit(50).all()
    return NotificationListResponse(
        notifications=notifications,
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
