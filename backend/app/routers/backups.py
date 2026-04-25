import os, shutil, secrets
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from pathlib import Path
from app.core.database import get_db
from app.models import User
from app.models.backup import Backup
from app.routers.auth import get_current_user, require_permission

router = APIRouter(prefix="/api/platform", tags=["平台公共"])

DATA_DIR = Path(__file__).resolve().parents[3] / "data"
BACKUP_DIR = DATA_DIR / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "omni.db"
UPLOAD_DIR = DATA_DIR / "uploads"


class BackupCreateResponse(BaseModel):
    success: bool
    message: str
    backup_id: str


class BackupSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    backup_id: str
    name: str
    type: str
    status: str
    file_size: int
    note: str
    created_at: datetime
    completed_at: Optional[datetime]

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
    current_user: User = Depends(require_permission("platform:backup:create")),
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
            backup_path = BACKUP_DIR / backup_name

            # 简单打包：DB + uploads
            import zipfile
            with zipfile.ZipFile(backup_path, "w", zipfile.ZIP_DEFLATED) as zf:
                # DB
                if DB_PATH.exists():
                    zf.write(DB_PATH, "omni.db")
                # uploads
                if UPLOAD_DIR.exists():
                    for root, dirs, files in os.walk(UPLOAD_DIR):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.join("uploads", os.path.relpath(file_path, str(UPLOAD_DIR)))
                            zf.write(file_path, arcname)

            file_size = backup_path.stat().st_size

            with Session(bind=db.get_bind()) as s:
                b = s.query(Backup).filter(Backup.backup_id == backup_id).first()
                if b:
                    b.status = "succeeded"
                    b.file_path = str(backup_path)
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


class RestoreResponse(BaseModel):
    success: bool
    message: str


@router.post("/backups/{backup_id}/restore", response_model=RestoreResponse)
def restore_backup(
    backup_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("platform:backup:restore")),
):
    """从备份恢复（需要 admin 权限，且需停止服务后操作）"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可执行恢复")
    backup = db.query(Backup).filter(Backup.backup_id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="备份不存在")
    if backup.status != "succeeded" or not backup.file_path:
        raise HTTPException(status_code=400, detail="备份文件不可用")
    backup_path = Path(backup.file_path)
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="备份文件已丢失")

    import zipfile, tempfile
    try:
        with zipfile.ZipFile(backup_path, "r") as zf:
            names = zf.namelist()
            if "omni.db" not in names:
                raise HTTPException(status_code=400, detail="备份文件格式无效：缺少 omni.db")
            # 检查是否为有效的 SQLite 数据库
            with zf.open("omni.db") as db_f:
                header = db_f.read(16)
                if header[:16] != b"SQLite format 3\x00":
                    raise HTTPException(status_code=400, detail="备份数据库文件无效")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"备份文件损坏：{e}")

    # 注意：在线恢复会影响运行中的连接，最安全的做法是：
    # 1. 停止服务
    # 2. 用 CLI 执行恢复：python3 cli.py db restore <backup_id>
    # 这里只记录操作日志，实际文件替换由 CLI 完成
    from app.models.record import OperationLog
    log = OperationLog(
        action="restore",
        target_type="Backup",
        target_id=backup_id,
        module="platform",
        operator_id=current_user.id,
        detail=f"发起备份恢复：{backup.name} ({backup_id})，请确保已停止服务",
        result="success",
    )
    db.add(log)
    db.commit()
    return RestoreResponse(
        success=True,
        message=(
            f"备份 {backup_id} 验证通过。请停止服务后执行：\n"
            f"python3 cli.py db restore {backup_id}\n"
            f"然后重新启动服务。"
        ),
    )
