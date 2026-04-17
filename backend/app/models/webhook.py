"""
Webhook 模型
支持事件订阅、签名验证、异步投递
"""
import hmac
import hashlib
import secrets
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from app.core.database import Base


class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    url = Column(Text, nullable=False)          # 目标 URL
    secret = Column(String(64), nullable=False) # HMAC 签名密钥
    events = Column(String(500), nullable=False) # 逗号分隔的事件列表
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_triggered_at = Column(DateTime, nullable=True)
    last_response_code = Column(Integer, nullable=True)
    failure_count = Column(Integer, default=0)

    def trigger(self, event: str, payload: dict) -> bool:
        """
        触发 webhook，POST 到目标 URL。
        返回是否成功（2xx 响应码）。
        """
        import httpx
        from datetime import datetime

        body = b'{"event":"' + event.encode() + b'","data":' + str(payload).encode() + b'}'
        signature = hmac.new(
            self.secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()

        try:
            resp = httpx.post(
                self.url,
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Omni-Signature": signature,
                    "X-Omni-Event": event,
                },
                timeout=10,
            )
            self.last_triggered_at = datetime.utcnow()
            self.last_response_code = resp.status_code
            if 200 <= resp.status_code < 300:
                self.failure_count = 0
                return True
            else:
                self.failure_count += 1
                return False
        except Exception:
            self.last_triggered_at = datetime.utcnow()
            self.failure_count += 1
            self.last_response_code = 0
            return False

    @staticmethod
    def generate_secret() -> str:
        return secrets.token_hex(32)
