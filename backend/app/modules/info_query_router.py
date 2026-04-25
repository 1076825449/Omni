import csv
import io
import json
import secrets
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User
from app.models.record import OperationLog
from app.models.taxpayer import TaxpayerInfo
from app.routers.auth import get_current_user
from app.services.xlsx_reader import read_xls_rows, read_xlsx_rows

router = APIRouter(prefix="/api/modules/info-query", tags=["信息查询表"])


FIELD_ALIASES = {
    "taxpayer_id": ["纳税人识别号", "税号", "统一社会信用代码", "社会信用代码（纳税人识别号）", "社会信用代码", "原纳税人识别号", "taxpayer_id", "tin", "credit_code"],
    "company_name": ["企业名称", "纳税人名称", "公司名称", "单位名称", "company_name", "name"],
    "legal_person": ["法定代表人", "法人", "法定代表人（负责人、业主）姓名", "legal_person"],
    "taxpayer_type": ["纳税人类型", "登记注册类型", "课征主体登记类型", "登记户类别", "taxpayer_type"],
    "registration_status": ["登记状态", "状态", "纳税人状态", "registration_status"],
    "industry": ["行业", "行业门类", "所属行业", "industry"],
    "region": ["区域", "属地", "行政区划", "region"],
    "tax_bureau": ["主管税务机关", "税务机关", "tax_bureau"],
    "manager_department": ["管理分局", "管理科所", "主管科室", "管户部门", "主管税务所（科、分局）", "manager_department"],
    "tax_officer": ["税收管理员", "管理员", "管户人员", "tax_officer"],
    "credit_rating": ["纳税信用等级", "信用等级", "credit_rating"],
    "risk_level": ["风险等级", "风险级别", "risk_level"],
    "address": ["注册地址", "生产经营地址", "经营地址", "地址", "address"],
    "phone": ["联系电话", "电话", "注册地联系电话", "经营地联系电话", "法定代表人（负责人、业主）移动电话", "phone"],
    "business_scope": ["经营范围", "business_scope"],
}


class TaxpayerInfoSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    taxpayer_id: str
    company_name: str
    legal_person: str
    taxpayer_type: str
    registration_status: str
    industry: str
    region: str
    tax_bureau: str
    manager_department: str
    tax_officer: str
    credit_rating: str
    risk_level: str
    address: str
    phone: str
    business_scope: str
    source_batch: str
    created_at: datetime
    updated_at: datetime


class TaxpayerListResponse(BaseModel):
    taxpayers: list[TaxpayerInfoSchema]
    total: int


class ImportPreviewResponse(BaseModel):
    success: bool
    message: str
    batch: str
    imported: int
    updated: int
    skipped: int
    headers: list[str]


class AssignmentStatsResponse(BaseModel):
    by_officer: dict[str, int]
    by_department: dict[str, int]
    by_risk_level: dict[str, int]
    total: int


def canonical_header(value: str) -> str:
    text = str(value or "").strip()
    lower = text.lower()
    for key, aliases in FIELD_ALIASES.items():
        if lower == key or any(lower == alias.lower() for alias in aliases):
            return key
    return text


def normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in row.items():
        canonical = canonical_header(key)
        text = str(value or "").strip()
        if canonical not in normalized or (not normalized[canonical] and text):
            normalized[canonical] = text
    return normalized


def parse_upload_rows(file: UploadFile, content: bytes) -> tuple[list[dict[str, Any]], list[str]]:
    filename = file.filename or "unknown"
    suffix = Path(filename).suffix.lower()
    if suffix == ".json":
        payload = json.loads(content.decode("utf-8", errors="ignore"))
        if isinstance(payload, dict):
            for key in ("rows", "data", "items", "records"):
                if isinstance(payload.get(key), list):
                    rows = [normalize_row(item) for item in payload[key] if isinstance(item, dict)]
                    return rows, list(rows[0].keys()) if rows else []
            rows = [normalize_row(payload)]
            return rows, list(rows[0].keys()) if rows else []
        if isinstance(payload, list):
            rows = [normalize_row(item) for item in payload if isinstance(item, dict)]
            return rows, list(rows[0].keys()) if rows else []
        return [], []

    if suffix in {".xlsx", ".xls"}:
        from tempfile import NamedTemporaryFile

        with NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
            tmp.write(content)
            tmp.flush()
            reader = read_xls_rows if suffix == ".xls" else read_xlsx_rows
            rows = [normalize_row(item) for item in reader(tmp.name)]
            return rows, list(rows[0].keys()) if rows else []

    text = content.decode("utf-8-sig", errors="ignore")
    delimiter = "\t" if suffix == ".tsv" else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    rows = [normalize_row(item) for item in reader]
    return rows, list(rows[0].keys()) if rows else [canonical_header(item) for item in (reader.fieldnames or [])]


def row_to_taxpayer(row: dict[str, Any], batch: str, owner_id: int) -> dict[str, Any]:
    return {
        "taxpayer_id": row.get("taxpayer_id", ""),
        "company_name": row.get("company_name", ""),
        "legal_person": row.get("legal_person", ""),
        "taxpayer_type": row.get("taxpayer_type", ""),
        "registration_status": row.get("registration_status", ""),
        "industry": row.get("industry", ""),
        "region": row.get("region", ""),
        "tax_bureau": row.get("tax_bureau", ""),
        "manager_department": row.get("manager_department", ""),
        "tax_officer": row.get("tax_officer", ""),
        "credit_rating": row.get("credit_rating", ""),
        "risk_level": row.get("risk_level", ""),
        "address": row.get("address", ""),
        "phone": row.get("phone", ""),
        "business_scope": row.get("business_scope", ""),
        "source_batch": batch,
        "raw_json": json.dumps(row, ensure_ascii=False),
        "owner_id": owner_id,
    }


def log_action(db: Session, action: str, target_id: str, operator_id: int, detail: str):
    db.add(OperationLog(
        action=action,
        target_type="TaxpayerInfo",
        target_id=target_id,
        module="info-query",
        operator_id=operator_id,
        detail=detail,
        result="success",
    ))


@router.post("/import", response_model=ImportPreviewResponse)
def import_taxpayer_info(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = file.file.read()
    rows, headers = parse_upload_rows(file, content)
    batch = f"info-{datetime.now().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4)}"
    imported = 0
    updated = 0
    skipped = 0

    for row in rows:
        taxpayer_id = row.get("taxpayer_id", "")
        company_name = row.get("company_name", "")
        if not taxpayer_id or not company_name:
            skipped += 1
            continue

        payload = row_to_taxpayer(row, batch, current_user.id)
        existing = db.query(TaxpayerInfo).filter(
            TaxpayerInfo.owner_id == current_user.id,
            TaxpayerInfo.taxpayer_id == taxpayer_id,
        ).first()
        if existing:
            for key, value in payload.items():
                if key != "owner_id":
                    setattr(existing, key, value)
            updated += 1
        else:
            db.add(TaxpayerInfo(**payload))
            imported += 1

    log_action(db, "import", batch, current_user.id, f"导入信息查询表: {file.filename}, 新增 {imported}, 更新 {updated}, 跳过 {skipped}")
    db.commit()
    return ImportPreviewResponse(
        success=True,
        message=f"导入完成：新增 {imported} 条，更新 {updated} 条，跳过 {skipped} 条",
        batch=batch,
        imported=imported,
        updated=updated,
        skipped=skipped,
        headers=headers,
    )


@router.get("/taxpayers", response_model=TaxpayerListResponse)
def list_taxpayers(
    q: Optional[str] = Query(None),
    tax_officer: Optional[str] = Query(None),
    manager_department: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(TaxpayerInfo).filter(TaxpayerInfo.owner_id == current_user.id)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            TaxpayerInfo.company_name.like(like),
            TaxpayerInfo.taxpayer_id.like(like),
            TaxpayerInfo.legal_person.like(like),
        ))
    if tax_officer:
        query = query.filter(TaxpayerInfo.tax_officer.like(f"%{tax_officer}%"))
    if manager_department:
        query = query.filter(TaxpayerInfo.manager_department.like(f"%{manager_department}%"))
    if industry:
        query = query.filter(TaxpayerInfo.industry.like(f"%{industry}%"))
    if region:
        query = query.filter(TaxpayerInfo.region.like(f"%{region}%"))
    if risk_level:
        query = query.filter(TaxpayerInfo.risk_level == risk_level)
    total = query.count()
    taxpayers = query.order_by(TaxpayerInfo.updated_at.desc()).offset(offset).limit(limit).all()
    return TaxpayerListResponse(taxpayers=taxpayers, total=total)


@router.get("/taxpayers/{taxpayer_id}", response_model=TaxpayerInfoSchema)
def get_taxpayer(
    taxpayer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(TaxpayerInfo).filter(
        TaxpayerInfo.owner_id == current_user.id,
        TaxpayerInfo.taxpayer_id == taxpayer_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="信息查询表中不存在该纳税人")
    return item


@router.get("/assignment-stats", response_model=AssignmentStatsResponse)
def assignment_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(TaxpayerInfo).filter(TaxpayerInfo.owner_id == current_user.id).all()
    by_officer: dict[str, int] = {}
    by_department: dict[str, int] = {}
    by_risk_level: dict[str, int] = {}
    for row in rows:
        by_officer[row.tax_officer or "未分配"] = by_officer.get(row.tax_officer or "未分配", 0) + 1
        by_department[row.manager_department or "未分配"] = by_department.get(row.manager_department or "未分配", 0) + 1
        by_risk_level[row.risk_level or "未标记"] = by_risk_level.get(row.risk_level or "未标记", 0) + 1
    return AssignmentStatsResponse(
        by_officer=by_officer,
        by_department=by_department,
        by_risk_level=by_risk_level,
        total=len(rows),
    )
