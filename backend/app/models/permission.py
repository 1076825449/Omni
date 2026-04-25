from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON
from datetime import datetime
from app.core.database import Base

# 预定义权限点
ALL_PERMISSIONS = {
    # 模块访问权限
    "module:analysis-workbench:view",
    "module:analysis-workbench:operate",
    "module:analysis-workbench:export",
    "module:record-operations:view",
    "module:record-operations:operate",
    "module:risk-ledger:view",
    "module:risk-ledger:operate",
    "module:learning-lab:view",
    "module:learning-lab:operate",
    # 平台公共
    "platform:task:view",
    "platform:task:operate",
    "platform:file:view",
    "platform:file:operate",
    "platform:log:view",
    "platform:log:export",
    "platform:backup:create",
    "platform:backup:restore",
    "platform:settings:manage",
    "platform:role:manage",
}

ROLE_PERMISSIONS = {
    "admin": list(ALL_PERMISSIONS),
    "user": [
        "module:analysis-workbench:view",
        "module:analysis-workbench:operate",
        "module:analysis-workbench:export",
        "module:record-operations:view",
        "module:record-operations:operate",
        "module:risk-ledger:view",
        "module:risk-ledger:operate",
        "module:learning-lab:view",
        "module:learning-lab:operate",
        "platform:task:view",
        "platform:task:operate",
        "platform:file:view",
        "platform:file:operate",
        "platform:log:view",
    ],
    "viewer": [
        "module:analysis-workbench:view",
        "module:record-operations:view",
        "module:risk-ledger:view",
        "module:learning-lab:view",
        "platform:task:view",
        "platform:file:view",
        "platform:log:view",
    ],
}


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(String(255), default="")
    permissions = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
