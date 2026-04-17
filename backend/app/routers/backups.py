import os, shutil, secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.models import User
from app.models.backup import Backup
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/platform", tags=["平台公共"])

BACKUP_DIR = os.path.expanduser("~/.omni/backups")
os.makedirs(BACKUP_DIR, exist_ok=True)

DB_PATH = os.path.expanduser("~/.omni/omni.db")
UPLOAD_DIR = os.path.expanduser("~/.omni/uploads")


class BackupCreateResponse(BaseModel):
    success: bool
    message: str
    backup_id: str


class BackupSchema(BaseModel):
    id: int
    backup_id: str
    name: str
    type: str
    status: str
    file_size: int
    note: str
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class BackupListResponse(BaseModel):
    backups: List[BackupSchema]
    total: int


def make_backup_id() -> str:
    return f"backup-{datetime.now().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4)}"


@router.post("/backup", response_model=BackupCreateResponse)
def create_backup(
    name: str = "手动备份",
    note: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """发起备份（异步执行：复制 DB + uploads 目录）"""
    import threading

    backup_id = make_backup_id()
    backup = Backup(
        backup_id=backup_id,
        name=name,
        type="manual",
        status="running",
        note=note,
        operator_id=current_user.id,
    )
    db.add(backup)
    db.commit()

    def do_backup():
        try:
            date_str = datetime.now().strftime("%Y%m%d")
            backup_name = f"{backup_id}.zip"
            backup_path = os.path.join(BACKUP_DIR, backup_name)

            # 简单打包：DB + uploads
            import zipfile
            with zipfile.ZipFile(backup_path, "w", zipfile.ZIP_DEFLATED) as zf:
                # DB
                if os.path.exists(DB_PATH):
                    zf.write(DB_PATH, "omni.db")
                # uploads
                if os.path.exists(UPLOAD_DIR):
                    for root, dirs, files in os.walk(UPLOAD_DIR):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.join("uploads", os.path.relpath(file_path, UPLOAD_DIR))
                            zf.write(file_path, arcname)

            file_size = os.path.getsize(backup_path)

            with Session(bind=db.get_bind()) as s:
                b = s.query(Backup).filter(Backup.backup_id == backup_id).first()
                if b:
                    b.status = "succeeded"
                    b.file_path = backup_path
                    b.file_size = file_size
                    b.completed_at = datetime.utcnow()
                    s.commit()
        except Exception as e:
            with Session(bind=db.get_bind()) as s:
                b = s.query(Backup).filter(Backup.backup_id == backup_id).first()
                if b:
                    b.status = "failed"
                    b.note = str(e)
                    s.commit()

    threading.Thread(target=do_backup, daemon=True).start()
    return BackupCreateResponse(success=True, message="备份已开始", backup_id=backup_id)


@router.get("/backups", response_model=BackupListResponse)
def list_backups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    backups = db.query(Backup).order_by(Backup.created_at.desc()).limit(50).all()
    return BackupListResponse(backups=backups, total=len(backups))


@router.get("/backups/{backup_id}/download")
def download_backup(
    backup_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    backup = db.query(Backup).filter(Backup.backup_id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="备份不存在")
    if backup.status != "succeeded" or not backup.file_path:
        raise HTTPException(status_code=400, detail="备份未完成或文件不存在")
    if not os.path.exists(backup.file_path):
        raise HTTPException(status_code=404, detail="备份文件已丢失")
    from fastapi.responses import FileResponse
    filename = f"{backup.name}-{backup.backup_id}.zip"
    return FileResponse(
        backup.file_path,
        filename=filename,
        media_type="application/zip",
    )
