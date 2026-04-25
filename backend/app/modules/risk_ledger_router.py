import csv
import io
import json
import secrets
from datetime import datetime, time
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User
from app.models.record import OperationLog
from app.models.risk_ledger import RiskDossier, RiskLedgerEntry
from app.models.taxpayer import TaxpayerInfo
from app.routers.auth import get_current_user
from app.services.xlsx_reader import read_xls_rows, read_xlsx_rows

router = APIRouter(prefix="/api/modules/risk-ledger", tags=["风险记录台账"])

ENTRY_STATUSES = {"待核实", "已排除", "整改中", "已整改"}

FIELD_ALIASES = {
    "taxpayer_id": ["纳税人识别号", "税号", "统一社会信用代码", "社会信用代码（纳税人识别号）", "taxpayer_id"],
    "company_name": ["纳税人名称", "企业名称", "公司名称", "单位名称", "company_name"],
    "registration_status": ["登记状态", "纳税人状态", "状态", "registration_status"],
    "tax_officer": ["税收管理员", "管理员", "管户人员", "tax_officer"],
    "address": ["地址", "注册地址", "经营地址", "生产经营地址", "address"],
    "recorded_at": ["记录时间", "发生时间", "触发时间", "recorded_at"],
    "content": ["记录内容", "风险内容", "内容", "问题描述", "content"],
    "entry_status": ["事项状态", "处理状态", "风险状态", "entry_status"],
    "note": ["备注", "note"],
}


class DossierSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    taxpayer_id: str
    company_name: str
    registration_status: str
    tax_officer: str
    address: str
    is_temporary: bool
    source: str
    owner_id: int
    created_at: datetime
    updated_at: datetime
    latest_recorded_at: Optional[datetime] = None
    latest_content: str = ""
    latest_entry_status: str = ""
    entry_count: int = 0


class EntrySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entry_id: str
    dossier_id: int
    taxpayer_id: str
    recorded_at: datetime
    content: str
    entry_status: str
    note: str
    owner_id: int
    created_by: int
    created_at: datetime


class DossierListResponse(BaseModel):
    dossiers: list[DossierSchema]
    total: int


class DossierDetailResponse(BaseModel):
    dossier: DossierSchema
    entries: list[EntrySchema]


class EntryCreateRequest(BaseModel):
    taxpayer_id: str
    recorded_at: datetime
    content: str
    entry_status: str = "待核实"
    company_name: str = ""
    registration_status: str = ""
    tax_officer: str = ""
    address: str = ""
    note: str = ""


class BatchTextRequest(BaseModel):
    taxpayer_ids: list[str]
    recorded_at: datetime
    content: str
    entry_status: str = "待核实"
    note: str = ""


class BatchResultResponse(BaseModel):
    success: bool
    message: str
    created: int
    failed: int
    failures: list[dict[str, str]] = []


class StatsResponse(BaseModel):
    dossier_total: int
    entry_total: int
    pending_count: int
    rectifying_count: int
    excluded_count: int
    rectified_count: int
    temporary_count: int


def canonical_header(value: str) -> str:
    text = str(value or "").strip()
    lower = text.lower()
    for key, aliases in FIELD_ALIASES.items():
        if lower == key or any(lower == alias.lower() for alias in aliases):
            return key
    return text


def normalize_row(row: dict[str, Any]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for key, value in row.items():
        canonical = canonical_header(key)
        text = str(value or "").strip()
        if canonical not in normalized or (not normalized[canonical] and text):
            normalized[canonical] = text
    return normalized


def parse_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    text = str(value or "").strip()
    if not text:
        return datetime.utcnow()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"无法识别记录时间: {text}")


def validate_entry_status(value: str) -> str:
    status = (value or "待核实").strip()
    if status not in ENTRY_STATUSES:
        raise HTTPException(status_code=400, detail=f"事项状态必须为: {','.join(sorted(ENTRY_STATUSES))}")
    return status


def log_action(db: Session, action: str, target_id: str, operator_id: int, detail: str):
    db.add(OperationLog(
        action=action,
        target_type="RiskLedger",
        target_id=target_id,
        module="risk-ledger",
        operator_id=operator_id,
        detail=detail,
        result="success",
    ))


def get_taxpayer_profile(taxpayer_id: str, db: Session, owner_id: int) -> Optional[TaxpayerInfo]:
    return db.query(TaxpayerInfo).filter(
        TaxpayerInfo.owner_id == owner_id,
        TaxpayerInfo.taxpayer_id == taxpayer_id,
    ).first()


def get_or_create_dossier(body: EntryCreateRequest, db: Session, user_id: int) -> RiskDossier:
    taxpayer_id = body.taxpayer_id.strip()
    if not taxpayer_id:
        raise HTTPException(status_code=400, detail="纳税人识别号不能为空")
    existing = db.query(RiskDossier).filter(
        RiskDossier.owner_id == user_id,
        RiskDossier.taxpayer_id == taxpayer_id,
    ).first()
    taxpayer = get_taxpayer_profile(taxpayer_id, db, user_id)
    if existing:
        if taxpayer and existing.is_temporary:
            existing.company_name = taxpayer.company_name
            existing.registration_status = taxpayer.registration_status
            existing.tax_officer = taxpayer.tax_officer
            existing.address = taxpayer.address
            existing.is_temporary = False
            existing.source = "info-query"
        return existing

    if taxpayer:
        dossier = RiskDossier(
            taxpayer_id=taxpayer_id,
            company_name=taxpayer.company_name,
            registration_status=taxpayer.registration_status,
            tax_officer=taxpayer.tax_officer,
            address=taxpayer.address,
            is_temporary=False,
            source="info-query",
            owner_id=user_id,
        )
    elif body.company_name.strip():
        dossier = RiskDossier(
            taxpayer_id=taxpayer_id,
            company_name=body.company_name.strip(),
            registration_status=body.registration_status.strip(),
            tax_officer=body.tax_officer.strip(),
            address=body.address.strip(),
            is_temporary=True,
            source="manual",
            owner_id=user_id,
        )
    else:
        raise HTTPException(status_code=400, detail=f"信息查询表中未找到 {taxpayer_id}，请提供纳税人名称后创建临时档案")

    db.add(dossier)
    db.flush()
    return dossier


def create_entry(body: EntryCreateRequest, db: Session, user: User) -> RiskLedgerEntry:
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="记录内容不能为空")
    body.entry_status = validate_entry_status(body.entry_status)
    body.recorded_at = parse_datetime(body.recorded_at)
    dossier = get_or_create_dossier(body, db, user.id)
    entry = RiskLedgerEntry(
        entry_id=f"risk-{secrets.token_hex(8)}",
        dossier_id=dossier.id,
        taxpayer_id=dossier.taxpayer_id,
        recorded_at=body.recorded_at,
        content=content,
        entry_status=body.entry_status,
        note=body.note.strip(),
        owner_id=user.id,
        created_by=user.id,
    )
    db.add(entry)
    db.flush()
    dossier.updated_at = datetime.utcnow()
    return entry


def entry_summary(dossier_id: int, db: Session) -> tuple[Optional[RiskLedgerEntry], int]:
    count = db.query(RiskLedgerEntry).filter(RiskLedgerEntry.dossier_id == dossier_id).count()
    latest = db.query(RiskLedgerEntry).filter(
        RiskLedgerEntry.dossier_id == dossier_id
    ).order_by(RiskLedgerEntry.recorded_at.desc(), RiskLedgerEntry.id.desc()).first()
    return latest, count


def dossier_to_schema(dossier: RiskDossier, db: Session) -> DossierSchema:
    latest, count = entry_summary(dossier.id, db)
    return DossierSchema(
        id=dossier.id,
        taxpayer_id=dossier.taxpayer_id,
        company_name=dossier.company_name,
        registration_status=dossier.registration_status,
        tax_officer=dossier.tax_officer,
        address=dossier.address,
        is_temporary=dossier.is_temporary,
        source=dossier.source,
        owner_id=dossier.owner_id,
        created_at=dossier.created_at,
        updated_at=dossier.updated_at,
        latest_recorded_at=latest.recorded_at if latest else None,
        latest_content=latest.content if latest else "",
        latest_entry_status=latest.entry_status if latest else "",
        entry_count=count,
    )


def parse_upload_rows(file: UploadFile, content: bytes) -> list[dict[str, str]]:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix in {".xlsx", ".xls"}:
        with NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
            tmp.write(content)
            tmp.flush()
            rows = read_xls_rows(tmp.name) if suffix == ".xls" else read_xlsx_rows(tmp.name)
            return [normalize_row(row) for row in rows]
    text = content.decode("utf-8-sig", errors="ignore")
    delimiter = "\t" if suffix == ".tsv" else ","
    return [normalize_row(row) for row in csv.DictReader(io.StringIO(text), delimiter=delimiter)]


@router.get("/dossiers", response_model=DossierListResponse)
def list_dossiers(
    q: Optional[str] = Query(None),
    tax_officer: Optional[str] = Query(None),
    registration_status: Optional[str] = Query(None),
    entry_status: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(RiskDossier).filter(RiskDossier.owner_id == current_user.id)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            RiskDossier.taxpayer_id.like(like),
            RiskDossier.company_name.like(like),
            RiskDossier.address.like(like),
        ))
    if tax_officer:
        query = query.filter(RiskDossier.tax_officer.like(f"%{tax_officer}%"))
    if registration_status:
        query = query.filter(RiskDossier.registration_status == registration_status)
    if entry_status or date_from or date_to:
        entry_query = db.query(RiskLedgerEntry.dossier_id).filter(RiskLedgerEntry.owner_id == current_user.id)
        if entry_status:
            entry_query = entry_query.filter(RiskLedgerEntry.entry_status == entry_status)
        if date_from:
            entry_query = entry_query.filter(RiskLedgerEntry.recorded_at >= date_from)
        if date_to:
            end_dt = datetime.combine(date_to.date(), time.max)
            entry_query = entry_query.filter(RiskLedgerEntry.recorded_at <= end_dt)
        query = query.filter(RiskDossier.id.in_(select(entry_query.subquery().c.dossier_id)))
    total = query.count()
    dossiers = query.order_by(RiskDossier.updated_at.desc()).offset(offset).limit(limit).all()
    return DossierListResponse(dossiers=[dossier_to_schema(item, db) for item in dossiers], total=total)


@router.get("/dossiers/{taxpayer_id}", response_model=DossierDetailResponse)
def get_dossier(
    taxpayer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dossier = db.query(RiskDossier).filter(
        RiskDossier.owner_id == current_user.id,
        RiskDossier.taxpayer_id == taxpayer_id,
    ).first()
    if not dossier:
        raise HTTPException(status_code=404, detail="风险档案不存在")
    entries = db.query(RiskLedgerEntry).filter(
        RiskLedgerEntry.owner_id == current_user.id,
        RiskLedgerEntry.dossier_id == dossier.id,
    ).order_by(RiskLedgerEntry.recorded_at.desc(), RiskLedgerEntry.id.desc()).all()
    return DossierDetailResponse(dossier=dossier_to_schema(dossier, db), entries=entries)


@router.post("/entries", response_model=EntrySchema)
def add_entry(
    body: EntryCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = create_entry(body, db, current_user)
    log_action(db, "create", entry.entry_id, current_user.id, f"新增风险台账记录: {entry.taxpayer_id}")
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/entries/batch-text", response_model=BatchResultResponse)
def add_batch_text_entries(
    body: BatchTextRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    created = 0
    failures: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw in body.taxpayer_ids:
        taxpayer_id = raw.strip()
        if not taxpayer_id or taxpayer_id in seen:
            continue
        seen.add(taxpayer_id)
        try:
            create_entry(EntryCreateRequest(
                taxpayer_id=taxpayer_id,
                recorded_at=body.recorded_at,
                content=body.content,
                entry_status=body.entry_status,
                note=body.note,
            ), db, current_user)
            created += 1
        except HTTPException as exc:
            failures.append({"taxpayer_id": taxpayer_id, "reason": str(exc.detail)})
    log_action(db, "import", f"batch-{secrets.token_hex(4)}", current_user.id, f"批量新增风险台账记录: 成功 {created}, 失败 {len(failures)}")
    db.commit()
    return BatchResultResponse(
        success=len(failures) == 0,
        message=f"批量完成：新增 {created} 条，失败 {len(failures)} 条",
        created=created,
        failed=len(failures),
        failures=failures,
    )


@router.post("/entries/import", response_model=BatchResultResponse)
def import_entries(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = parse_upload_rows(file, file.file.read())
    created = 0
    failures: list[dict[str, str]] = []
    for index, row in enumerate(rows, start=2):
        taxpayer_id = row.get("taxpayer_id", "").strip()
        content = row.get("content", "").strip()
        if not taxpayer_id or not content:
            failures.append({"row": str(index), "taxpayer_id": taxpayer_id, "reason": "纳税人识别号和记录内容必填"})
            continue
        try:
            create_entry(EntryCreateRequest(
                taxpayer_id=taxpayer_id,
                company_name=row.get("company_name", ""),
                registration_status=row.get("registration_status", ""),
                tax_officer=row.get("tax_officer", ""),
                address=row.get("address", ""),
                recorded_at=parse_datetime(row.get("recorded_at")),
                content=content,
                entry_status=row.get("entry_status", "待核实") or "待核实",
                note=row.get("note", ""),
            ), db, current_user)
            created += 1
        except HTTPException as exc:
            failures.append({"row": str(index), "taxpayer_id": taxpayer_id, "reason": str(exc.detail)})
    log_action(db, "import", f"file-{secrets.token_hex(4)}", current_user.id, f"导入风险台账记录: {file.filename}, 成功 {created}, 失败 {len(failures)}")
    db.commit()
    return BatchResultResponse(
        success=len(failures) == 0,
        message=f"导入完成：新增 {created} 条，失败 {len(failures)} 条",
        created=created,
        failed=len(failures),
        failures=failures,
    )


@router.get("/stats", response_model=StatsResponse)
def stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base = db.query(RiskLedgerEntry).filter(RiskLedgerEntry.owner_id == current_user.id)
    counts = dict(
        base.with_entities(RiskLedgerEntry.entry_status, func.count(RiskLedgerEntry.id))
        .group_by(RiskLedgerEntry.entry_status)
        .all()
    )
    return StatsResponse(
        dossier_total=db.query(RiskDossier).filter(RiskDossier.owner_id == current_user.id).count(),
        entry_total=base.count(),
        pending_count=counts.get("待核实", 0),
        rectifying_count=counts.get("整改中", 0),
        excluded_count=counts.get("已排除", 0),
        rectified_count=counts.get("已整改", 0),
        temporary_count=db.query(RiskDossier).filter(
            RiskDossier.owner_id == current_user.id,
            RiskDossier.is_temporary == True,
        ).count(),
    )
