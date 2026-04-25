from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel, ConfigDict
from app.core.database import get_db
from app.models import User
from app.models.record import FileRecord, OperationLog


def log_action(db: Session, action: str, target_id: str, operator_id: int, detail: str = "", result: str = "success"):
    db.add(OperationLog(
        action=action,
        target_type="FileRecord",
        target_id=target_id,
        module="platform",
        operator_id=operator_id,
        detail=detail,
        result=result,
    ))
from app.routers.auth import get_current_user
from pathlib import Path
import json
from app.services.xlsx_reader import read_xlsx_rows

router = APIRouter(prefix="/api/files", tags=["文件"])


class FileRecordSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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

class FileListResponse(BaseModel):
    files: List[FileRecordSchema]
    total: int


class FilePreviewResponse(BaseModel):
    file_id: str
    original_name: str
    mime_type: str
    preview_type: str
    content: Optional[str] = None
    preview_url: Optional[str] = None


@router.get("", response_model=FileListResponse)
def list_files(
    q: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    mime_type: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取文件列表。支持按模块/状态/MIME类型筛选，分页返回。"""
    query = db.query(FileRecord).filter(FileRecord.owner_id == current_user.id)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                FileRecord.name.like(like),
                FileRecord.original_name.like(like),
            )
        )
    if module:
        query = query.filter(FileRecord.module == module)
    if status:
        query = query.filter(FileRecord.status == status)
    if mime_type:
        query = query.filter(FileRecord.mime_type.like(f"%{mime_type}%"))
    total = query.count()
    files = query.order_by(FileRecord.created_at.desc()).offset(offset).limit(limit).all()
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


@router.get("/{file_id}/download")
def download_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """下载指定文件。"""
    f = db.query(FileRecord).filter(
        FileRecord.file_id == file_id,
        FileRecord.owner_id == current_user.id,
    ).first()
    if not f:
        raise HTTPException(status_code=404, detail="文件不存在")
    if not f.path:
        raise HTTPException(status_code=400, detail="文件缺少存储路径")
    path = Path(f.path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="文件内容不存在")
    log_action(db, "download", file_id, current_user.id, detail=f"下载文件: {f.original_name}")
    db.commit()
    return FileResponse(str(path), media_type=f.mime_type or "application/octet-stream", filename=f.original_name)


@router.get("/{file_id}/preview", response_model=FilePreviewResponse)
def preview_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    file = db.query(FileRecord).filter(
        FileRecord.file_id == file_id,
        FileRecord.owner_id == current_user.id,
    ).first()
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")
    if not file.path:
        raise HTTPException(status_code=400, detail="文件缺少存储路径")

    path = Path(file.path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="文件内容不存在")

    suffix = path.suffix.lower()
    mime_type = file.mime_type or ""
    raw = path.read_bytes()
    sample = raw[:30000]

    if suffix in {".png", ".jpg", ".jpeg", ".gif", ".webp"} or mime_type.startswith("image/"):
        return FilePreviewResponse(
            file_id=file.file_id,
            original_name=file.original_name,
            mime_type=mime_type,
            preview_type="image",
            content=f"文件名：{file.original_name}\n文件大小：{len(raw)} 字节\nMIME 类型：{mime_type or 'image'}\n\n⚠️ 作为佐证文件存储，不自动 OCR 识别内容。如需分析，请下载后处理。",
        )

    if suffix == ".pdf" or mime_type == "application/pdf":
        return FilePreviewResponse(
            file_id=file.file_id,
            original_name=file.original_name,
            mime_type=mime_type,
            preview_type="unsupported",
            content=f"文件名：{file.original_name}\n文件大小：{len(raw)} 字节\nMIME 类型：{mime_type or 'application/pdf'}\n\n⚠️ PDF 文件不提供内嵌预览。如需查看内容，请下载后处理。",
        )

    text_content = sample.decode("utf-8", errors="ignore")

    if suffix == ".json":
        try:
            formatted = json.dumps(json.loads(text_content), ensure_ascii=False, indent=2)
            return FilePreviewResponse(
                file_id=file.file_id,
                original_name=file.original_name,
                mime_type=mime_type,
                preview_type="code",
                content=formatted[:12000],
            )
        except Exception:
            pass

    if suffix == ".xlsx":
        rows = read_xlsx_rows(str(path))
        preview_text = json.dumps(rows[:20], ensure_ascii=False, indent=2)
        return FilePreviewResponse(
            file_id=file.file_id,
            original_name=file.original_name,
            mime_type=mime_type,
            preview_type="code",
            content=preview_text[:12000],
        )

    if suffix in {".txt", ".csv", ".json", ".md", ".log"} or mime_type.startswith("text/") or "json" in mime_type:
        return FilePreviewResponse(
            file_id=file.file_id,
            original_name=file.original_name,
            mime_type=mime_type,
            preview_type="text",
            content=text_content[:12000],
        )

    return FilePreviewResponse(
        file_id=file.file_id,
        original_name=file.original_name,
        mime_type=mime_type,
        preview_type="unsupported",
        content="当前仅支持文本、JSON、CSV、XLSX 和图片预览。",
    )
