from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from datetime import datetime
from app.core.database import Base


class Record(Base):
    __tablename__ = "records"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(50), default="")
    assignee = Column(String(100), default="")
    status = Column(String(20), default="active")  # active / archived / locked
    tags = Column(String(255), default="")  # comma-separated
    detail = Column(Text, default="")
    import_batch = Column(String(64), default="")
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
