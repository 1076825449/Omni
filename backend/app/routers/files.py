from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models import User
from app.models.record import FileRecord, OperationLog
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/files", tags=["文件"])


class FileRecordSchema(BaseModel):
    id: int
    file_id: str
    name: str
    original_name: str
    module: str
    owner_id: int
    size: int
    mime_type: str
    status: str
    created_at: str

    class Config:
        from_attributes = True


class FileListResponse(BaseModel):
    files: List[FileRecordSchema]
    total: int


@router.get("", response_model=FileListResponse)
def list_files(
    module: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    mime_type: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取文件列表。支持按模块/状态/MIME类型筛选，分页返回。"""
    q = db.query(FileRecord).filter(FileRecord.owner_id == current_user.id)
    if module:
        q = q.filter(FileRecord.module == module)
    if status:
        q = q.filter(FileRecord.status == status)
    if mime_type:
        q = q.filter(FileRecord.mime_type.like(f"%{mime_type}%"))
    total = q.count()
    files = q.order_by(FileRecord.created_at.desc()).offset(offset).limit(limit).all()
    return FileListResponse(
        files=[
            FileRecordSchema(
                id=f.id,
                file_id=f.file_id,
                name=f.name,
                original_name=f.original_name,
                module=f.module,
                owner_id=f.owner_id,
                size=f.size,
                mime_type=f.mime_type,
                status=f.status,
                created_at=f.created_at.isoformat(),
            )
            for f in files
        ],
        total=total,
    )


@router.post("/{file_id}/archive")
def archive_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """归档指定文件。归档后文件标记为 archived 状态。"""
    f = db.query(FileRecord).filter(
        FileRecord.file_id == file_id,
        FileRecord.owner_id == current_user.id,
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="文件不存在")
    f.status = "archived"
    db.add(OperationLog(
        action="delete",
        target_type="FileRecord",
        target_id=file_id,
        module=f.module,
        operator_id=current_user.id,
        detail=f"归档文件: {f.original_name}",
        result="success",
    ))
    db.commit()
    return {"success": True, "message": "文件已归档"}
