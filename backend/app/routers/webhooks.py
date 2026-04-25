"""
Webhook 管理接口
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from app.core.database import get_db
from app.models import User, Webhook
from app.routers.auth import get_current_user
from app.services.webhook import WebhookService

router = APIRouter(prefix="/api/webhooks", tags=["Webhook"])


class WebhookSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    url: str
    events: str
    is_active: bool
    created_at: str
    last_triggered_at: Optional[str] = None
    last_response_code: Optional[int] = None
    failure_count: int

class WebhookCreate(BaseModel):
    name: str
    url: str
    events: List[str]  # ["task.completed", "file.uploaded"]


class WebhookCreateResponse(BaseModel):
    id: int
    name: str
    url: str
    secret: str  # 仅创建时返回一次
    events: str


@router.get("", response_model=List[WebhookSchema])
def list_webhooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出所有 webhook（当前为全局，未来可改为用户级）"""
    webhooks = db.query(Webhook).order_by(Webhook.created_at.desc()).all()
    return [
        WebhookSchema(
            id=w.id,
            name=w.name,
            url=w.url,
            events=w.events,
            is_active=w.is_active,
            created_at=w.created_at.isoformat(),
            last_triggered_at=w.last_triggered_at.isoformat() if w.last_triggered_at else None,
            last_response_code=w.last_response_code,
            failure_count=w.failure_count,
        )
        for w in webhooks
    ]


@router.post("", response_model=WebhookCreateResponse)
def create_webhook(
    body: WebhookCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建新的 webhook。返回 secret（仅此一次），请妥善保存。"""
    wh = WebhookService.create_webhook(body.name, body.url, body.events)
    return WebhookCreateResponse(
        id=wh.id,
        name=wh.name,
        url=wh.url,
        secret=wh.secret,
        events=wh.events,
    )


@router.delete("/{webhook_id}")
def delete_webhook(
    webhook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除 webhook"""
    wh = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook 不存在")
    db.delete(wh)
    db.commit()
    return {"success": True, "message": "Webhook 已删除"}


@router.post("/{webhook_id}/test")
def test_webhook(
    webhook_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """发送测试事件到 webhook"""
    wh = db.query(Webhook).filter(Webhook.id == webhook_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook 不存在")
    ok = wh.trigger("test", {"message": "这是一条测试消息"})
    db.commit()
    return {
        "success": ok,
        "last_response_code": wh.last_response_code,
        "message": "投递成功" if ok else "投递失败，请检查 URL 是否可达",
    }
