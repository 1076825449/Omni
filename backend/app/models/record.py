from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from datetime import datetime
from app.core.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(64), unique=True, index=True, nullable=False)  # 业务ID，如 analysis-20231001-001
    name = Column(String(200), nullable=False)
    type = Column(String(30), nullable=False)  # analysis / import / export / practice / 其他
    status = Column(String(20), nullable=False, default="queued")  # queued / running / succeeded / failed / cancelled
    module = Column(String(50), nullable=False)  # 所属模块 key
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    result_summary = Column(Text, default="")
    taxpayer_id = Column(String(64), default="")
    company_name = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class FileRecord(Base):
    __tablename__ = "file_records"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    module = Column(String(50), nullable=False)  # 所属模块 key
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    size = Column(Integer, default=0)  # bytes
    mime_type = Column(String(100), default="")
    path = Column(String(500), default="")  # 存储路径
    status = Column(String(20), default="active")  # active / archived / deleted
    created_at = Column(DateTime, default=datetime.utcnow)


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(30), nullable=False)  # create / update / delete / import / export / login / logout
    target_type = Column(String(50), nullable=False)  # 操作对象类型，如 Task / FileRecord / User
    target_id = Column(String(64), nullable=False)  # 操作对象ID
    module = Column(String(50), nullable=False)  # 所属模块 key
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    detail = Column(Text, default="")  # 操作详情 JSON
    result = Column(String(20), default="success")  # success / failed
    created_at = Column(DateTime, default=datetime.utcnow)
