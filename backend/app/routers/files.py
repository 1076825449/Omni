from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models import User
from app.models.record import FileRecord
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
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(FileRecord)
    if module:
        q = q.filter(FileRecord.module == module)
    if status:
        q = q.filter(FileRecord.status == status)
    total = q.count()
    files = q.order_by(FileRecord.created_at.desc()).offset(offset).limit(limit).all()
    return FileListResponse(files=files, total=total)
