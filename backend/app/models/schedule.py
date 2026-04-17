"""
Schedule 定时任务模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from app.core.database import Base


class ScheduledTask(Base):
    __tablename__ = "scheduled_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    cron_expression = Column(String(100), nullable=False)  # e.g. "0 9 * * *"
    task_type = Column(String(50), nullable=False)  # e.g. "analysis", "backup"
    task_params = Column(Text, nullable=True)  # JSON params for the task
    is_active = Column(Boolean, default=True)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)
    last_result = Column(String(50), nullable=True)  # success / failed / null
    created_by = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
