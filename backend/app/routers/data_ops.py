"""
数据导出/导入接口
GET  /api/platform/backup/export   — 导出全量数据（JSON）
POST /api/platform/backup/import — 导入数据（JSON）
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any, Dict
from app.core.database import get_db
from app.models import User, Role, Module, Task, FileRecord, OperationLog
from app.models.records import Record
from app.models.learning import TrainingSet, PracticeSession
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/platform/backup", tags=["平台公共"])


class ExportResponse(BaseModel):
    exported_at: str
    version: str
    summary: Dict[str, int]
    data: Dict[str, Any]


def make_export(user_id: int, db: Session) -> Dict[str, Any]:
    """生成导出数据"""
    return {
        "exported_at": datetime.utcnow().isoformat(),
        "version": "1.0.0",

        # 角色（全部）
        "roles": [
            {
                "name": r.name,
                "display_name": r.display_name,
                "description": r.description,
                "permissions": r.permissions,
                "is_active": r.is_active,
            }
            for r in db.query(Role).all()
        ],

        # 用户（仅当前用户，去密码）
        "users": [
            {
                "username": u.username,
                "nickname": u.nickname,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in db.query(User).filter(User.id == user_id).all()
        ],

        # 模块注册信息
        "modules": [
            {
                "key": m.key,
                "name": m.name,
                "description": m.description,
                "type": m.type,
                "priority": m.priority,
                "status": m.status,
                "icon": m.icon,
                "is_active": m.is_active,
            }
            for m in db.query(Module).all()
        ],

        # 任务（当前用户）
        "tasks": [
            {
                "task_id": t.task_id,
                "name": t.name,
                "type": t.type,
                "status": t.status,
                "module": t.module,
                "result_summary": t.result_summary,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            }
            for t in db.query(Task).filter(Task.creator_id == user_id).all()
        ],

        # 文件元数据（当前用户，不含实际文件）
        "files": [
            {
                "file_id": f.file_id,
                "name": f.name,
                "original_name": f.original_name,
                "module": f.module,
                "size": f.size,
                "mime_type": f.mime_type,
                "status": f.status,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in db.query(FileRecord).filter(FileRecord.owner_id == user_id).all()
        ],

        # 对象管理记录（当前用户）
        "records": [
            {
                "record_id": r.record_id,
                "name": r.name,
                "category": r.category,
                "assignee": r.assignee,
                "status": r.status,
                "tags": r.tags,
                "detail": r.detail,
                "import_batch": r.import_batch,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in db.query(Record).filter(Record.owner_id == user_id).all()
        ],

        # 联动日志（当前用户）
        "operation_logs": [
            {
                "action": l.action,
                "target_type": l.target_type,
                "target_id": l.target_id,
                "module": l.module,
                "detail": l.detail,
                "result": l.result,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in db.query(OperationLog).filter(OperationLog.operator_id == user_id).limit(500).all()
        ],

        # 学习训练（当前用户）
        "learning_sets": [
            {
                "set_id": s.set_id,
                "name": s.name,
                "description": s.description,
                "category": s.category,
                "difficulty": s.difficulty,
                "tags": s.tags,
                "is_active": s.is_active,
            }
            for s in db.query(TrainingSet).all()
        ],

        "practice_sessions": [
            {
                "session_id": s.sid,
                "set_id": s.set_id,
                "set_name": s.set_name,
                "status": s.status,
                "score": s.score,
                "correct_count": s.correct_count,
                "total_count": s.total_count,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            }
            for s in db.query(PracticeSession).filter(PracticeSession.user_id == user_id).all()
        ],
    }


@router.get("/export")
def export_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """导出全量数据（JSON）。不含密码、secret 等敏感信息。"""
    data = make_export(current_user.id, db)
    summary = {k: len(v) for k, v in data.items() if k not in ("exported_at", "version")}
    summary.pop("roles", None)
    return {
        "exported_at": data["exported_at"],
        "version": data["version"],
        "summary": summary,
        "data": data,
    }


class ImportRequest(BaseModel):
    data: Dict[str, Any]
    mode: str = "merge"  # merge = 合并，replace = 替换


@router.post("/import")
def import_data(
    body: ImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """导入数据。roles 和 modules 仅管理员可操作。"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可导入数据")

    imported = {"roles": 0, "modules": 0, "tasks": 0, "records": 0}

    # 导入角色
    for role_data in body.data.get("roles", []):
        existing = db.query(Role).filter(Role.name == role_data["name"]).first()
        if existing:
            existing.display_name = role_data.get("display_name", existing.display_name)
            existing.description = role_data.get("description", "")
            existing.permissions = role_data.get("permissions", [])
            existing.is_active = role_data.get("is_active", True)
        else:
            db.add(Role(
                name=role_data["name"],
                display_name=role_data.get("display_name", role_data["name"]),
                description=role_data.get("description", ""),
                permissions=role_data.get("permissions", []),
                is_active=role_data.get("is_active", True),
            ))
        imported["roles"] += 1

    # 导入模块
    for mod_data in body.data.get("modules", []):
        # 严格使用 key 字段，不再接受 module_id 作为别名（ROADMAP B1）
        module_key = mod_data.get("key")
        if not module_key:
            continue

        existing = db.query(Module).filter(Module.key == module_key).first()
        if not existing:
            db.add(Module(
                key=module_key,
                name=mod_data["name"],
                description=mod_data.get("description", ""),
                type=mod_data.get("type", "custom"),
                priority=mod_data.get("priority", "medium"),
                status=mod_data.get("status", "active"),
                icon=mod_data.get("icon", "appstore"),
                is_active=mod_data.get("is_active", True),
            ))
            imported["modules"] += 1

    db.commit()
    return {
        "success": True,
        "message": f"导入完成：{imported}",
        "imported": imported,
    }
