from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from app.core.database import Base


class CrossLinkLog(Base):
    """跨模块联动日志"""
    __tablename__ = "cross_link_logs"

    id = Column(Integer, primary_key=True, index=True)
    source_module = Column(String(50), nullable=False)
    source_type = Column(String(20), nullable=False)   # task / record / file
    source_id = Column(String(64), nullable=False)
    target_module = Column(String(50), nullable=False)
    target_type = Column(String(20), nullable=False)    # task / record / file
    target_id = Column(String(64), nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
