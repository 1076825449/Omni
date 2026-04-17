from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from datetime import datetime
from app.core.database import Base


class Backup(Base):
    __tablename__ = "backups"

    id = Column(Integer, primary_key=True, index=True)
    backup_id = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    type = Column(String(20), default="manual")  # manual / auto
    status = Column(String(20), default="pending")  # pending / running / succeeded / failed
    file_path = Column(String(500), default="")
    file_size = Column(Integer, default=0)  # bytes
    note = Column(Text, default="")
    operator_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
