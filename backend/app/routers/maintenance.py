import os
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import DEFAULT_DB_PATH, get_db
from app.core.shared_scope import business_owner_id
from app.models import FileRecord, Record, User
from app.models.backup import Backup
from app.models.record import OperationLog
from app.models.risk_ledger import RiskDossier, RiskLedgerEntry
from app.models.settings import SystemSetting
from app.models.taxpayer import TaxpayerInfo
from app.routers.auth import require_permission
from app.routers.backups import BACKUP_DIR, UPLOAD_DIR, make_backup_id
from app.services.audit import log_action

router = APIRouter(prefix="/api/platform", tags=["系统维护"])


class ConsolidateResponse(BaseModel):
    success: bool
    message: str
    backup_id: str
    taxpayer_moved: int
    taxpayer_merged: int
    dossiers_moved: int
    dossiers_merged: int
    entries_moved: int
    files_moved: int
    records_moved: int
    settings_moved: int


class HealthResponse(BaseModel):
    status: str
    database: dict
    uploads: dict
    backups: dict
    data_source: dict


class AuditLogItem(BaseModel):
    id: int
    action: str
    target_type: str
    target_id: str
    module: str
    operator_id: int
    operator_name: str
    detail: str
    result: str
    created_at: datetime


class AuditLogResponse(BaseModel):
    logs: list[AuditLogItem]
    total: int


def create_sync_backup(db: Session, operator_id: int, name: str, note: str) -> str:
    backup_id = make_backup_id()
    backup = Backup(
        backup_id=backup_id,
        name=name,
        type="manual",
        status="running",
        note=note,
        operator_id=operator_id,
    )
    db.add(backup)
    db.flush()

    backup_path = BACKUP_DIR / f"{backup_id}.zip"
    with zipfile.ZipFile(backup_path, "w", zipfile.ZIP_DEFLATED) as zf:
        db_path = Path(db.get_bind().url.database or DEFAULT_DB_PATH)
        if db_path.exists():
            zf.write(db_path, "omni.db")
        if UPLOAD_DIR.exists():
            for root, _dirs, files in os.walk(UPLOAD_DIR):
                for file in files:
                    file_path = Path(root) / file
                    arcname = Path("uploads") / file_path.relative_to(UPLOAD_DIR)
                    zf.write(file_path, str(arcname))

    backup.status = "succeeded"
    backup.file_path = str(backup_path)
    backup.file_size = backup_path.stat().st_size
    backup.completed_at = datetime.utcnow()
    db.flush()
    return backup_id


def merge_taxpayer(target: TaxpayerInfo, source: TaxpayerInfo):
    for key in [
        "company_name", "legal_person", "taxpayer_type", "registration_status", "industry",
        "region", "tax_bureau", "manager_department", "tax_officer", "proposed_tax_officer",
        "credit_rating", "risk_level", "address", "phone", "business_scope", "source_batch", "raw_json",
    ]:
        value = getattr(source, key, None)
        if value:
            setattr(target, key, value)
    if source.industry_tag_manual:
        target.industry_tag = source.industry_tag
        target.industry_tag_manual = True
    elif source.industry_tag and not target.industry_tag_manual:
        target.industry_tag = source.industry_tag
    if source.address_tag_manual:
        target.address_tag = source.address_tag
        target.address_tag_manual = True
    elif source.address_tag and not target.address_tag_manual:
        target.address_tag = source.address_tag
    if source.last_used_at and (not target.last_used_at or source.last_used_at > target.last_used_at):
        target.last_used_at = source.last_used_at


def merge_dossier(target: RiskDossier, source: RiskDossier):
    for key in ["company_name", "registration_status", "tax_officer", "address", "source"]:
        value = getattr(source, key, None)
        if value:
            setattr(target, key, value)
    target.is_temporary = bool(target.is_temporary and source.is_temporary)
    target.updated_at = datetime.utcnow()


@router.post("/maintenance/consolidate-global-data", response_model=ConsolidateResponse)
def consolidate_global_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("platform:maintenance:operate")),
):
    target_owner = business_owner_id()
    if not db.query(User).filter(User.id == target_owner).first():
        raise HTTPException(status_code=500, detail="全局业务账号不存在，请先检查初始化数据")

    backup_id = create_sync_backup(db, current_user.id, "全局数据归并前自动备份", "系统维护：归并历史个人业务数据前自动生成")
    counts = {
        "taxpayer_moved": 0,
        "taxpayer_merged": 0,
        "dossiers_moved": 0,
        "dossiers_merged": 0,
        "entries_moved": 0,
        "files_moved": 0,
        "records_moved": 0,
        "settings_moved": 0,
    }

    taxpayers = db.query(TaxpayerInfo).filter(TaxpayerInfo.owner_id != target_owner).order_by(TaxpayerInfo.updated_at.asc()).all()
    for source in taxpayers:
        target = db.query(TaxpayerInfo).filter(
            TaxpayerInfo.owner_id == target_owner,
            TaxpayerInfo.taxpayer_id == source.taxpayer_id,
        ).first()
        if target:
            merge_taxpayer(target, source)
            db.delete(source)
            counts["taxpayer_merged"] += 1
        else:
            source.owner_id = target_owner
            counts["taxpayer_moved"] += 1

    dossiers = db.query(RiskDossier).filter(RiskDossier.owner_id != target_owner).order_by(RiskDossier.updated_at.asc()).all()
    for source in dossiers:
        target = db.query(RiskDossier).filter(
            RiskDossier.owner_id == target_owner,
            RiskDossier.taxpayer_id == source.taxpayer_id,
        ).first()
        if target:
            merge_dossier(target, source)
            db.query(RiskLedgerEntry).filter(RiskLedgerEntry.dossier_id == source.id).update({
                RiskLedgerEntry.dossier_id: target.id,
                RiskLedgerEntry.owner_id: target_owner,
            })
            db.delete(source)
            counts["dossiers_merged"] += 1
        else:
            old_owner = source.owner_id
            source.owner_id = target_owner
            moved_entries = db.query(RiskLedgerEntry).filter(RiskLedgerEntry.dossier_id == source.id, RiskLedgerEntry.owner_id == old_owner).update({
                RiskLedgerEntry.owner_id: target_owner,
            })
            counts["entries_moved"] += int(moved_entries or 0)
            counts["dossiers_moved"] += 1

    counts["entries_moved"] += int(db.query(RiskLedgerEntry).filter(RiskLedgerEntry.owner_id != target_owner).update({
        RiskLedgerEntry.owner_id: target_owner,
    }) or 0)
    counts["files_moved"] = int(db.query(FileRecord).filter(FileRecord.owner_id != target_owner).update({
        FileRecord.owner_id: target_owner,
    }) or 0)
    counts["records_moved"] = int(db.query(Record).filter(Record.owner_id != target_owner).update({
        Record.owner_id: target_owner,
    }) or 0)

    settings = db.query(SystemSetting).filter(SystemSetting.owner_id != target_owner).order_by(SystemSetting.updated_at.asc()).all()
    for source in settings:
        target = db.query(SystemSetting).filter(SystemSetting.owner_id == target_owner, SystemSetting.key == source.key).first()
        if target:
            if source.updated_at and (not target.updated_at or source.updated_at > target.updated_at):
                target.value = source.value
                target.updated_at = datetime.utcnow()
            db.delete(source)
        else:
            source.owner_id = target_owner
        counts["settings_moved"] += 1

    log_action(
        db,
        "consolidate_global_data",
        backup_id,
        current_user.id,
        f"归并历史业务数据，备份 {backup_id}，结果 {counts}",
        module="platform",
    )
    db.commit()
    return ConsolidateResponse(success=True, message="历史业务数据已归并到全局共享空间", backup_id=backup_id, **counts)


@router.get("/audit/logs", response_model=AuditLogResponse)
def list_audit_logs(
    q: Optional[str] = Query(None),
    operator_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    result: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("platform:audit:view")),
):
    _ = current_user
    query = db.query(OperationLog)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(OperationLog.detail.like(like), OperationLog.target_id.like(like), OperationLog.target_type.like(like)))
    if operator_id:
        query = query.filter(OperationLog.operator_id == operator_id)
    if action:
        query = query.filter(OperationLog.action == action)
    if module:
        query = query.filter(OperationLog.module == module)
    if result:
        query = query.filter(OperationLog.result == result)
    if date_from:
        query = query.filter(OperationLog.created_at >= date_from)
    if date_to:
        query = query.filter(OperationLog.created_at <= date_to)
    total = query.count()
    rows = query.order_by(OperationLog.created_at.desc()).offset(offset).limit(limit).all()
    users = {u.id: (u.nickname or u.username) for u in db.query(User).filter(User.id.in_([row.operator_id for row in rows] or [0])).all()}
    return AuditLogResponse(logs=[
        AuditLogItem(
            id=row.id,
            action=row.action,
            target_type=row.target_type,
            target_id=row.target_id,
            module=row.module,
            operator_id=row.operator_id,
            operator_name=users.get(row.operator_id, f"用户{row.operator_id}"),
            detail=row.detail or "",
            result=row.result,
            created_at=row.created_at,
        )
        for row in rows
    ], total=total)


@router.get("/health", response_model=HealthResponse)
def health(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("platform:settings:manage")),
):
    _ = current_user
    db_ok = True
    db_error = ""
    try:
        db.query(User).count()
    except Exception as exc:
        db_ok = False
        db_error = str(exc)
    db_path = Path(db.get_bind().url.database or DEFAULT_DB_PATH)
    latest_backup = db.query(Backup).order_by(Backup.created_at.desc()).first()
    latest_import = db.query(OperationLog).filter(
        OperationLog.module == "info-query",
        OperationLog.action == "import",
        OperationLog.result == "success",
    ).order_by(OperationLog.created_at.desc()).first()
    taxpayer_total = db.query(TaxpayerInfo).filter(TaxpayerInfo.owner_id == business_owner_id()).count() if db_ok else 0
    return HealthResponse(
        status="ok" if db_ok and UPLOAD_DIR.exists() else "warning",
        database={
            "ok": db_ok,
            "path": str(db_path),
            "exists": db_path.exists(),
            "size": db_path.stat().st_size if db_path.exists() else 0,
            "error": db_error,
        },
        uploads={
            "ok": UPLOAD_DIR.exists(),
            "path": str(UPLOAD_DIR),
            "file_count": sum(len(files) for _, _, files in os.walk(UPLOAD_DIR)) if UPLOAD_DIR.exists() else 0,
        },
        backups={
            "latest_backup_id": latest_backup.backup_id if latest_backup else "",
            "latest_status": latest_backup.status if latest_backup else "",
            "latest_created_at": latest_backup.created_at.isoformat() if latest_backup else "",
        },
        data_source={
            "taxpayer_total": taxpayer_total,
            "latest_batch": latest_import.target_id if latest_import else "",
            "latest_detail": latest_import.detail if latest_import else "",
            "latest_imported_at": latest_import.created_at.isoformat() if latest_import else "",
        },
    )
