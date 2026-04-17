"""
Webhook 服务 — 管理触发逻辑
"""
import threading
from typing import Dict, Any
from app.core.database import SessionLocal
from app.models.webhook import Webhook


class WebhookService:
    """管理 webhook 触发"""

    # 支持的事件类型
    SUPPORTED_EVENTS = {
        "task.completed",
        "task.failed",
        "analysis.done",
        "file.uploaded",
        "file.archived",
        "user.login",
    }

    @classmethod
    def trigger(cls, event: str, payload: Dict[str, Any], async_mode: bool = True):
        """
        触发所有订阅了指定事件的活跃 webhook。
        默认异步投递，避免阻塞主流程。
        """
        if event not in cls.SUPPORTED_EVENTS:
            return

        db = SessionLocal()
        try:
            webhooks = db.query(Webhook).filter(
                Webhook.is_active == True,
                Webhook.events.like(f"%{event}%"),
            ).all()

            for wh in webhooks:
                if async_mode:
                    # 异步投递（不阻塞主请求）
                    t = threading.Thread(target=wh.trigger, args=(event, payload))
                    t.start()
                else:
                    wh.trigger(event, payload)
                    db.commit()
        finally:
            db.close()

    @classmethod
    def create_webhook(cls, name: str, url: str, events: list[str]) -> Webhook:
        """创建 webhook"""
        db = SessionLocal()
        try:
            wh = Webhook(
                name=name,
                url=url,
                secret=Webhook.generate_secret(),
                events=",".join(events),
                is_active=True,
            )
            db.add(wh)
            db.commit()
            db.refresh(wh)
            return wh
        finally:
            db.close()
