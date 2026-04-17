from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from datetime import datetime
from app.core.database import Base


class Module(Base):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    type = Column(String(20), default="list")  # workflow / list / interactive
    priority = Column(String(10), default="medium")  # high / medium / low
    status = Column(String(20), default="active")  # active / developing / offline
    icon = Column(String(20), default="📦")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
