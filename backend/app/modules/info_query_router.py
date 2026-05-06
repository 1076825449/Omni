import csv
import io
import json
import secrets
import re
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.models import User
from app.models.record import OperationLog
from app.models.taxpayer import TaxpayerInfo
from app.routers.auth import get_current_user
from app.services.xlsx_reader import read_xls_rows, read_xlsx_rows

router = APIRouter(prefix="/api/modules/info-query", tags=["信息查询表"])

IMPORT_JOBS: dict[str, dict[str, Any]] = {}
IMPORT_JOBS_LOCK = threading.Lock()
INDUSTRY_TAG_RULE_VERSION = "business-v2"

TAXPAYER_EXPORT_HEADERS = [
    "登记表单展示",
    "纳税人联系信息（有独立查询功能）",
    "社会信用代码（纳税人识别号）",
    "纳税人名称",
    "纳税人状态",
    "课征主体登记类型",
    "登记注册类型",
    "组织机构代码",
    "单位隶属关系",
    "批准设立机关",
    "证照名称",
    "证照编号",
    "开业设立日期",
    "从业人数",
    "固定工人数",
    "组织机构类型",
    "会计制度（准则）",
    "经营范围",
    "行业",
    "登记机关",
    "登记日期",
    "主管税务机关",
    "主管税务所（科、分局）",
    "税收管理员",
    "街道乡镇",
    "国有控股类型",
    "国有投资比例",
    "自然人投资比例",
    "外资投资比例",
    "注册资本",
    "投资总额",
    "营改增纳税人类型",
    "办证方式",
    "核算方式",
    "非居民企业标志",
    "跨区财产税主体登记标志",
    "有效标志",
    "注册地址",
    "注册地联系电话",
    "经营地址",
    "经营地联系电话",
    "法定代表人（负责人、业主）姓名",
    "法定代表人（负责人、业主）身份证件名称",
    "法定代表人（负责人、业主）身份证件号码",
    "法定代表人（负责人、业主）固定电话",
    "法定代表人（负责人、业主）移动电话",
    "财务负责人姓名",
    "财务负责人身份证件号码",
    "财务负责人固定电话",
    "财务负责人移动电话",
    "办税人姓名",
    "办税人身份证件号码",
    "办税人固定电话",
    "办税人移动电话",
    "录入人",
    "录入日期",
    "修改人",
    "修改日期",
    "纳税人编号",
    "税收档案编号",
    "社会信用代码",
    "原纳税人识别号",
    "评估机关",
    "工商注销日期",
    "是否三证合一或两证整合纳税人",
    "受理信息",
    "总分机构类型",
    "总机构信息",
    "分支机构信息",
    "跨区域涉税事项报验管理编号",
    "纳税人主体类型",
    "登记户自定义类别",
    "民营企业",
    "市监市场主体类型",
    "市监登记行业",
]


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
    proposed_tax_officer: str = ""
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


class ImportJobResponse(BaseModel):
    job_id: str
    status: str
    phase: str
    filename: str
    batch: str
    progress_percent: int
    total_rows: int
    processed_rows: int
    imported: int
    updated: int
    skipped: int
    message: str
    error: str = ""
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None


class AssignmentStatsResponse(BaseModel):
    by_officer: dict[str, int]
    by_department: dict[str, int]
    by_risk_level: dict[str, int]
    by_industry_tag: dict[str, int]
    by_address_tag: dict[str, int]
    total: int


class TaxpayerAssignmentRequest(BaseModel):
    taxpayer_ids: list[str]
    tax_officer: str = ""
    proposed_tax_officer: str = ""


class TaxpayerAssignmentResponse(BaseModel):
    success: bool
    updated: int
    tax_officer: str
    proposed_tax_officer: str


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
    haystack = compact_text(f"{industry}{company_name}{business_scope}")
    keyword_groups = [
        ("汽车销售及维修", ["汽车", "汽配", "机动车", "二手车", "轮胎", "洗车", "电动车", "汽车零配件", "汽车修理", "汽车维修", "修理与维护"]),
        ("木材加工", ["木材", "木业", "木制", "板材", "胶合板", "木片", "锯材", "单板", "竹木", "木质家具"]),
        ("食品生产", ["食品生产", "粮食加工", "农副食品加工", "食品制造", "糕点制造", "饮料制造", "肉制品", "豆制品", "调味品", "茶叶加工", "屠宰", "酿酒", "酒类生产"]),
        ("餐饮", ["餐饮", "饭店", "餐馆", "小吃", "正餐", "快餐", "奶茶", "烧烤", "饮品", "饮料及冷饮服务"]),
        ("建筑工程", ["建筑", "工程", "施工", "安装", "装饰", "装修", "土木", "市政", "园林绿化", "工程劳务", "建筑劳务"]),
        ("建材五金", ["建材", "五金", "钢材", "水泥", "砂石", "陶瓷", "消防器材", "电线电缆", "室内装饰材料"]),
        ("交通运输", ["运输", "物流", "货运", "快递", "道路运输", "搬运", "仓储"]),
        ("农林牧渔", ["农业", "种植", "养殖", "畜牧", "水产", "农资", "苗圃", "林业", "果蔬", "农产品", "农副产品"]),
        ("医药健康", ["医药", "药店", "诊所", "医院", "医疗", "西药", "中药", "药品", "医疗器械"]),
        ("美容养生", ["理发", "美容", "美发", "养生", "保健", "按摩", "足浴"]),
        ("居民服务", ["照相", "复印", "打印", "家政", "洗染", "摄影", "居民服务", "日用品修理"]),
        ("房产物业", ["房地产", "物业", "置业", "不动产", "房屋租赁"]),
        ("教育培训", ["教育", "培训", "学校", "托管", "文化艺术"]),
        ("商务服务", ["咨询", "广告", "传媒", "会议", "会展", "代理", "商务服务", "企业管理", "劳务派遣", "信息服务"]),
        ("加工制造", ["制造", "加工", "机械", "设备", "配件", "工厂", "生产", "制品", "电子元件", "金属制品", "塑料制品"]),
        ("贸易", ["批发", "零售", "商贸", "贸易", "超市", "便利店", "销售", "经营部", "网店", "电子商务", "百货"]),
    ]
    for tag, keywords in keyword_groups:
        if any(keyword in haystack for keyword in keywords):
            return tag
    return "其他"


def rebuild_industry_tags(db: Session, owner_id: Optional[int] = None) -> int:
    query = db.query(TaxpayerInfo)
    if owner_id is not None:
        query = query.filter(TaxpayerInfo.owner_id == owner_id)
    changed = 0
    for item in query.yield_per(500):
        next_tag = derive_industry_tag(item.industry or "", item.company_name or "", item.business_scope or "")
        if item.industry_tag != next_tag:
            item.industry_tag = next_tag
            changed += 1
    return changed


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


def taxpayer_query(
    db: Session,
    owner_id: int,
    q: Optional[str] = None,
    tax_officer: Optional[str] = None,
    manager_department: Optional[str] = None,
    industry: Optional[str] = None,
    industry_tag: Optional[str] = None,
    address_tag: Optional[str] = None,
    registration_status: Optional[str] = None,
    region: Optional[str] = None,
    risk_level: Optional[str] = None,
):
    query = db.query(TaxpayerInfo).filter(TaxpayerInfo.owner_id == owner_id)
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
    return query


def taxpayer_export_value(row: TaxpayerInfo, header: str) -> str:
    try:
        raw = json.loads(row.raw_json or "{}")
    except Exception:
        raw = {}
    canonical = canonical_header(header)
    value = raw.get(header, raw.get(canonical, ""))
    if value:
        return str(value)
    fallback = {
        "taxpayer_id": row.taxpayer_id,
        "company_name": row.company_name,
        "legal_person": row.legal_person,
        "taxpayer_type": row.taxpayer_type,
        "registration_status": row.registration_status,
        "industry": row.industry,
        "region": row.region,
        "tax_bureau": row.tax_bureau,
        "manager_department": row.manager_department,
        "tax_officer": row.tax_officer,
        "credit_rating": row.credit_rating,
        "risk_level": row.risk_level,
        "address": row.address,
        "business_address": row.address,
        "phone": row.phone,
        "business_scope": row.business_scope,
    }
    return str(fallback.get(canonical, ""))


def job_payload(job: dict[str, Any]) -> ImportJobResponse:
    payload = {key: value for key, value in job.items() if key != "owner_id"}
    return ImportJobResponse(**payload)


def update_import_job(job_id: str, **patch: Any):
    with IMPORT_JOBS_LOCK:
        job = IMPORT_JOBS.get(job_id)
        if not job:
            return
        job.update(patch)
        job["updated_at"] = datetime.utcnow()


def apply_import_rows(
    rows: list[dict[str, Any]],
    filename: str,
    batch: str,
    owner_id: int,
    db: Session,
    job_id: Optional[str] = None,
) -> tuple[int, int, int]:
    imported = 0
    updated = 0
    skipped = 0
    total = len(rows)
    for index, row in enumerate(rows, start=1):
        taxpayer_id = row.get("taxpayer_id", "")
        company_name = row.get("company_name", "")
        if not taxpayer_id or not company_name:
            skipped += 1
        else:
            payload = row_to_taxpayer(row, batch, owner_id)
            existing = db.query(TaxpayerInfo).filter(
                TaxpayerInfo.owner_id == owner_id,
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

        if job_id and (index == total or index % 100 == 0):
            update_import_job(
                job_id,
                phase="写入数据库",
                processed_rows=index,
                imported=imported,
                updated=updated,
                skipped=skipped,
                progress_percent=15 + int(index / max(total, 1) * 80),
                message=f"正在写入第 {index} / {total} 行",
            )

    log_action(db, "import", batch, owner_id, f"导入信息查询表: {filename}, 新增 {imported}, 更新 {updated}, 跳过 {skipped}")
    db.commit()
    return imported, updated, skipped


def process_import_job(job_id: str, filename: str, content: bytes, owner_id: int):
    db = SessionLocal()
    try:
        update_import_job(job_id, status="running", phase="解析文件", progress_percent=5, message="正在读取表格字段")
        upload_stub = type("UploadStub", (), {"filename": filename})()
        rows, headers = parse_upload_rows(upload_stub, content)  # type: ignore[arg-type]
        with IMPORT_JOBS_LOCK:
            job = IMPORT_JOBS[job_id]
        update_import_job(
            job_id,
            phase="准备写入",
            total_rows=len(rows),
            progress_percent=15,
            message=f"已识别 {len(rows)} 行，准备写入数据库",
        )
        imported, updated, skipped = apply_import_rows(rows, filename, job["batch"], owner_id, db, job_id)
        update_import_job(
            job_id,
            status="succeeded",
            phase="导入完成",
            processed_rows=len(rows),
            imported=imported,
            updated=updated,
            skipped=skipped,
            progress_percent=100,
            message=f"导入完成：新增 {imported} 条，更新 {updated} 条，跳过 {skipped} 条",
            headers=headers,
            completed_at=datetime.utcnow(),
        )
    except Exception as exc:
        db.rollback()
        update_import_job(
            job_id,
            status="failed",
            phase="导入失败",
            error=str(exc),
            message="导入失败，请检查文件是否加密、表头是否正确或重新上传",
            completed_at=datetime.utcnow(),
        )
    finally:
        db.close()


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
    imported, updated, skipped = apply_import_rows(rows, file.filename or "unknown", batch, current_user.id, db)
    return ImportPreviewResponse(
        success=True,
        message=f"导入完成：新增 {imported} 条，更新 {updated} 条，跳过 {skipped} 条",
        batch=batch,
        imported=imported,
        updated=updated,
        skipped=skipped,
        headers=headers,
    )


@router.post("/import-jobs", response_model=ImportJobResponse)
def start_import_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    content = file.file.read()
    now = datetime.utcnow()
    job_id = f"job-{secrets.token_hex(8)}"
    batch = f"info-{datetime.now().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4)}"
    with IMPORT_JOBS_LOCK:
        IMPORT_JOBS[job_id] = {
            "job_id": job_id,
            "owner_id": current_user.id,
            "status": "queued",
            "phase": "等待处理",
            "filename": file.filename or "unknown",
            "batch": batch,
            "progress_percent": 1,
            "total_rows": 0,
            "processed_rows": 0,
            "imported": 0,
            "updated": 0,
            "skipped": 0,
            "message": "文件已上传，等待后台解析",
            "error": "",
            "created_at": now,
            "updated_at": now,
            "completed_at": None,
        }
    background_tasks.add_task(process_import_job, job_id, file.filename or "unknown", content, current_user.id)
    with IMPORT_JOBS_LOCK:
        return job_payload(IMPORT_JOBS[job_id])


@router.get("/import-jobs/{job_id}", response_model=ImportJobResponse)
def get_import_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
):
    with IMPORT_JOBS_LOCK:
        job = IMPORT_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="导入任务不存在或已过期")
    if job.get("owner_id") != current_user.id:
        raise HTTPException(status_code=404, detail="导入任务不存在或已过期")
    return job_payload(job)


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
    query = taxpayer_query(
        db,
        current_user.id,
        q,
        tax_officer,
        manager_department,
        industry,
        industry_tag,
        address_tag,
        registration_status,
        region,
        risk_level,
    )
    total = query.count()
    taxpayers = query.order_by(TaxpayerInfo.updated_at.desc()).offset(offset).limit(limit).all()
    return TaxpayerListResponse(taxpayers=taxpayers, total=total)


@router.get("/taxpayers/export")
def export_taxpayers(
    q: Optional[str] = Query(None),
    tax_officer: Optional[str] = Query(None),
    manager_department: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    industry_tag: Optional[str] = Query(None),
    address_tag: Optional[str] = Query(None),
    registration_status: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = taxpayer_query(
        db,
        current_user.id,
        q,
        tax_officer,
        manager_department,
        industry,
        industry_tag,
        address_tag,
        registration_status,
        region,
        risk_level,
    )
    rows = query.order_by(TaxpayerInfo.updated_at.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(TAXPAYER_EXPORT_HEADERS)
    for row in rows:
        writer.writerow([taxpayer_export_value(row, header) for header in TAXPAYER_EXPORT_HEADERS])
    filename = quote(f"税务登记信息查询导出_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


@router.post("/taxpayers/assignment", response_model=TaxpayerAssignmentResponse)
def update_taxpayer_assignment(
    body: TaxpayerAssignmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    taxpayer_ids = [item.strip() for item in body.taxpayer_ids if item.strip()]
    if not taxpayer_ids:
        raise HTTPException(status_code=400, detail="请选择需要分配的纳税人")
    rows = db.query(TaxpayerInfo).filter(
        TaxpayerInfo.owner_id == current_user.id,
        TaxpayerInfo.taxpayer_id.in_(taxpayer_ids),
    ).all()
    assigned = (body.tax_officer or body.proposed_tax_officer).strip()
    for row in rows:
        row.tax_officer = assigned
        row.proposed_tax_officer = assigned
    if rows:
        log_action(db, "assign_tax_officer", ",".join(taxpayer_ids[:20]), current_user.id, f"分配税收管理员：{assigned or '清空'}，户数 {len(rows)}")
    db.commit()
    return TaxpayerAssignmentResponse(success=True, updated=len(rows), tax_officer=assigned, proposed_tax_officer=assigned)


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
