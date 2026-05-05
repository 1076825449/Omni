import csv
import io
import json
import secrets
import re
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
    "business_address": ["生产经营地址", "经营地址"],
    "registered_address": ["注册地址"],
    "address": ["地址", "address"],
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
    industry_tag: str = ""
    region: str
    tax_bureau: str
    manager_department: str
    tax_officer: str
    credit_rating: str
    risk_level: str
    address: str
    address_tag: str = ""
    phone: str
    business_scope: str
    source_batch: str
    last_used_at: Optional[datetime] = None
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


class ImportHistoryItem(BaseModel):
    batch: str
    filename: str
    imported: int
    updated: int
    skipped: int
    total_processed: int
    created_at: datetime
    detail: str


class ImportHistoryResponse(BaseModel):
    items: list[ImportHistoryItem]


class AssignmentStatsResponse(BaseModel):
    by_officer: dict[str, int]
    by_department: dict[str, int]
    by_risk_level: dict[str, int]
    by_industry_tag: dict[str, int]
    by_address_tag: dict[str, int]
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


def compact_text(value: str) -> str:
    return re.sub(r"\s+", "", str(value or "").strip())


def derive_industry_tag(industry: str, company_name: str, business_scope: str) -> str:
    source = compact_text(industry)
    if source:
        return source[:30]
    haystack = compact_text(f"{company_name}{business_scope}")
    keyword_groups = [
        ("餐饮食品", ["餐饮", "饭店", "餐馆", "小吃", "食品", "奶茶", "烧烤"]),
        ("建材五金", ["建材", "装饰", "五金", "钢材", "水泥", "砂石", "陶瓷"]),
        ("交通运输", ["运输", "物流", "货运", "快递", "汽车租赁"]),
        ("农林牧渔", ["农业", "种植", "养殖", "农资", "苗圃", "水产"]),
        ("批发零售", ["批发", "零售", "商贸", "超市", "便利店", "销售"]),
        ("房产物业", ["房地产", "物业", "置业", "不动产", "房屋租赁"]),
        ("制造加工", ["制造", "加工", "机械", "配件", "设备", "工厂"]),
        ("医药健康", ["医药", "药店", "诊所", "医院", "医疗", "健康"]),
        ("教育培训", ["教育", "培训", "学校", "托管", "文化艺术"]),
        ("商务服务", ["咨询", "广告", "传媒", "服务", "管理"]),
    ]
    for tag, keywords in keyword_groups:
        if any(keyword in haystack for keyword in keywords):
            return tag
    return "未分类"


def derive_address_tag(address: str) -> str:
    text = compact_text(address)
    if not text:
        return ""
    text = re.sub(r"[，,。；;（）()【】\[\]]", "", text)
    text = re.sub(r"(广西壮族自治区|广西|柳州市|柳江区|柳江县|柳南区|城中区|鱼峰区|柳北区|柳城县|鹿寨县|融安县|融水县|三江县)", "", text)
    broad_only = re.fullmatch(r"[\u4e00-\u9fa5]{2,8}(镇|乡|村|社区|县|区|市)", text)
    if broad_only:
        return ""
    text = re.sub(r"^.*?(?:街道|镇|乡|村|社区)", "", text)
    if not text:
        return ""

    road_match = re.search(r"([\u4e00-\u9fa5A-Za-z0-9]{2,16}(?:大道|路|街|巷|道))([0-9一二三四五六七八九十]+号)?", text)
    if road_match:
        road = road_match.group(1)
        number = road_match.group(2) or ""
        if road.endswith("大道") and number:
            return f"{road}{number}"
        return road

    place_match = re.search(r"([\u4e00-\u9fa5A-Za-z0-9]{2,30}(?:市场|园区|小区|商贸城|工业园|广场|商城|城))", text)
    if place_match:
        return place_match.group(1)
    return ""


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
    address = row.get("business_address") or row.get("address") or row.get("registered_address", "")
    industry = row.get("industry", "")
    business_scope = row.get("business_scope", "")
    company_name = row.get("company_name", "")
    return {
        "taxpayer_id": row.get("taxpayer_id", ""),
        "company_name": company_name,
        "legal_person": row.get("legal_person", ""),
        "taxpayer_type": row.get("taxpayer_type", ""),
        "registration_status": row.get("registration_status", ""),
        "industry": industry,
        "industry_tag": derive_industry_tag(industry, company_name, business_scope),
        "region": row.get("region", ""),
        "tax_bureau": row.get("tax_bureau", ""),
        "manager_department": row.get("manager_department", ""),
        "tax_officer": row.get("tax_officer", ""),
        "credit_rating": row.get("credit_rating", ""),
        "risk_level": row.get("risk_level", ""),
        "address": address,
        "address_tag": derive_address_tag(address),
        "phone": row.get("phone", ""),
        "business_scope": business_scope,
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


def parse_import_log(log: OperationLog) -> ImportHistoryItem:
    filename_match = re.search(r"导入信息查询表:\s*(.*?),\s*新增", log.detail or "")
    imported_match = re.search(r"新增\s*(\d+)", log.detail or "")
    updated_match = re.search(r"更新\s*(\d+)", log.detail or "")
    skipped_match = re.search(r"跳过\s*(\d+)", log.detail or "")
    imported = int(imported_match.group(1)) if imported_match else 0
    updated = int(updated_match.group(1)) if updated_match else 0
    skipped = int(skipped_match.group(1)) if skipped_match else 0
    return ImportHistoryItem(
        batch=log.target_id,
        filename=filename_match.group(1).strip() if filename_match else "",
        imported=imported,
        updated=updated,
        skipped=skipped,
        total_processed=imported + updated + skipped,
        created_at=log.created_at,
        detail=log.detail or "",
    )


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


@router.get("/import-history", response_model=ImportHistoryResponse)
def import_history(
    limit: int = Query(8, le=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logs = db.query(OperationLog).filter(
        OperationLog.operator_id == current_user.id,
        OperationLog.module == "info-query",
        OperationLog.action == "import",
        OperationLog.result == "success",
    ).order_by(OperationLog.created_at.desc()).limit(limit).all()
    return ImportHistoryResponse(items=[parse_import_log(log) for log in logs])


@router.get("/taxpayers", response_model=TaxpayerListResponse)
def list_taxpayers(
    q: Optional[str] = Query(None),
    tax_officer: Optional[str] = Query(None),
    manager_department: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    industry_tag: Optional[str] = Query(None),
    address_tag: Optional[str] = Query(None),
    registration_status: Optional[str] = Query(None),
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
            TaxpayerInfo.tax_officer.like(like),
        ))
    if tax_officer:
        query = query.filter(TaxpayerInfo.tax_officer.like(f"%{tax_officer}%"))
    if manager_department:
        query = query.filter(TaxpayerInfo.manager_department.like(f"%{manager_department}%"))
    if industry:
        query = query.filter(TaxpayerInfo.industry.like(f"%{industry}%"))
    if industry_tag:
        query = query.filter(TaxpayerInfo.industry_tag == industry_tag)
    if address_tag:
        query = query.filter(TaxpayerInfo.address_tag == address_tag)
    if registration_status:
        query = query.filter(TaxpayerInfo.registration_status == registration_status)
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
    by_industry_tag: dict[str, int] = {}
    by_address_tag: dict[str, int] = {}
    for row in rows:
        by_officer[row.tax_officer or "未分配"] = by_officer.get(row.tax_officer or "未分配", 0) + 1
        by_department[row.manager_department or "未分配"] = by_department.get(row.manager_department or "未分配", 0) + 1
        by_risk_level[row.risk_level or "未标记"] = by_risk_level.get(row.risk_level or "未标记", 0) + 1
        by_industry_tag[row.industry_tag or "未分类"] = by_industry_tag.get(row.industry_tag or "未分类", 0) + 1
        by_address_tag[row.address_tag or "未识别地址"] = by_address_tag.get(row.address_tag or "未识别地址", 0) + 1
    return AssignmentStatsResponse(
        by_officer=by_officer,
        by_department=by_department,
        by_risk_level=by_risk_level,
        by_industry_tag=by_industry_tag,
        by_address_tag=by_address_tag,
        total=len(rows),
    )
