from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from datetime import datetime
from app.core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, default="")
    type = Column(String(20), default="info")  # info / success / warning / error
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
