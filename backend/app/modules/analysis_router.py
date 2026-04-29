import secrets
import json
from datetime import datetime, timedelta
from typing import Any, Optional, List
from urllib.parse import quote
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from app.core.database import get_db
from app.models import User
from app.models.record import Task, FileRecord, OperationLog
from app.models.records import Record
from app.models.cross_link import CrossLinkLog
from app.models.risk_ledger import RiskLedgerEntry
from app.models.taxpayer import TaxpayerInfo
from app.modules.risk_ledger_router import EntryCreateRequest, create_entry
from app.routers.auth import get_current_user
from app.routers.settings import get_document_settings
from app.services.file_service import save_upload
from app.services.document_templates import render_notice_docx, render_officer_report_docx
from app.services.tax_analysis import analyze_files, profile_file, render_notice_text, render_officer_report_text

router = APIRouter(prefix="/api/modules/analysis-workbench", tags=["分析工作模块"])


# --- Schemas ---
class TaskCreateRequest(BaseModel):
    name: str
    description: str = ""
    taxpayer_id: str = ""
    company_name: str = ""


class TaskItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: str
    name: str
    description: str
    status: str
    file_count: int
    created_at: datetime

class TaskListResponse(BaseModel):
    tasks: List[TaskItem]
    total: int


class TaskDetailResponse(BaseModel):
    id: int
    task_id: str
    name: str
    description: str
    status: str
    result_summary: str
    file_count: int
    files: List[str] = []
    related_record_count: int = 0
    related_record_ids: List[str] = []
    log_count: int = 0
    company_name: str = ""
    taxpayer_id: str = ""
    periods: List[str] = []
    risk_count: int = 0
    risks: List[dict] = []
    material_gap_list: List[str] = []
    taxpayer_profile: Optional[dict] = None
    data_warnings: List[str] = []
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]


class TaskCreatedResponse(BaseModel):
    success: bool
    message: str
    task_id: str


class UploadProfileResponse(BaseModel):
    dataset_kind: str
    source_type: str
    row_count: int
    headers: List[str] = []
    required_fields: List[str] = []
    missing_required_fields: List[str] = []
    warnings: List[str] = []


def apply_document_config(payload: dict[str, Any], config: dict[str, str]) -> dict[str, Any]:
    configured = dict(payload)
    for key, value in config.items():
        text = str(value or "").strip()
        if text:
            configured[key] = text
    return configured


class UploadResponse(BaseModel):
    success: bool
    message: str
    file_id: str
    profile: UploadProfileResponse


class ManualDataRequest(BaseModel):
    data_kind: str
    rows: List[dict[str, Any]]


class RiskReviewRequest(BaseModel):
    status: str
    note: str = ""


class LedgerSyncResponse(BaseModel):
    success: bool
    message: str
    entry_id: str


class AnalysisReportResponse(BaseModel):
    task_id: str
    name: str
    status: str
    result_summary: str
    file_count: int
    related_record_count: int
    related_record_ids: List[str]
    company_name: str = ""
    taxpayer_id: str = ""
    periods: List[str] = []
    risk_count: int = 0
    risks: List[dict] = []
    material_gap_list: List[str] = []
    data_warnings: List[str] = []
    created_at: str
    completed_at: Optional[str]


# --- Helpers ---
def make_task_id() -> str:
    return f"analysis-{datetime.now().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3)}"


def log_action(db: Session, action: str, target_id: str, operator_id: int,
               module: str = "analysis-workbench", detail: str = "", result: str = "success"):
    log = OperationLog(
        action=action,
        target_type="Task",
        target_id=target_id,
        module=module,
        operator_id=operator_id,
        detail=detail,
        result=result,
    )
    db.add(log)


def get_task_files(task_id: str, db: Session, user_id: int) -> list[FileRecord]:
    return db.query(FileRecord).filter(
        FileRecord.module == "analysis-workbench",
        FileRecord.owner_id == user_id,
        FileRecord.name.like(f"{task_id}%"),
    ).order_by(FileRecord.created_at.asc()).all()


def build_report_payload(task: Task, db: Session, user_id: int) -> AnalysisReportResponse:
    file_count = db.query(FileRecord).filter(
        FileRecord.module == "analysis-workbench",
        FileRecord.name.like(f"{task.task_id}%")
    ).count()
    files = get_task_files(task.task_id, db, user_id)
    analysis = analyze_files(task, files) if files else {
        "company_name": "",
        "taxpayer_id": "",
        "periods": [],
        "risk_count": 0,
        "risks": [],
        "material_gap_list": [],
        "data_warnings": [],
    }
    related = db.query(Record).filter(
        Record.import_batch.like(f"analysis-{task.task_id}%"),
        Record.owner_id == user_id,
    ).all()
    related_record_ids = [r.record_id for r in related]
    return AnalysisReportResponse(
        task_id=task.task_id,
        name=task.name,
        status=task.status,
        result_summary=task.result_summary or "",
        file_count=file_count,
        related_record_count=len(related_record_ids),
        related_record_ids=related_record_ids,
        company_name=analysis["company_name"] or "",
        taxpayer_id=analysis["taxpayer_id"] or "",
        periods=analysis["periods"],
        risk_count=analysis["risk_count"],
        risks=analysis["risks"],
        material_gap_list=analysis.get("material_gap_list", []),
        data_warnings=analysis["data_warnings"],
        created_at=task.created_at.isoformat() if task.created_at else "",
        completed_at=task.completed_at.isoformat() if task.completed_at else None,
    )


def enrich_analysis_review_state(analysis: dict, task_id: str, db: Session, user_id: int) -> dict:
    records = db.query(Record).filter(
        Record.import_batch == f"analysis-{task_id}",
        Record.owner_id == user_id,
    ).all()
    used: set[str] = set()
    for risk in analysis.get("risks", []):
        matched = None
        for record in records:
            if record.record_id in used:
                continue
            if risk["risk_type"] in (record.tags or "") and (record.detail or "").startswith(f"{risk['period']}："):
                matched = record
                break
        if matched is None:
            for record in records:
                if record.record_id in used:
                    continue
                if risk["risk_type"] in (record.tags or ""):
                    matched = record
                    break
        if matched:
            used.add(matched.record_id)
            risk["review_record_id"] = matched.record_id
            risk["review_status"] = matched.status or "pending_review"
        else:
            risk["review_record_id"] = None
            risk["review_status"] = "not_synced"
    return analysis


def get_taxpayer_profile(taxpayer_id: str, db: Session, user_id: int) -> Optional[dict]:
    if not taxpayer_id:
        return None
    item = db.query(TaxpayerInfo).filter(
        TaxpayerInfo.owner_id == user_id,
        TaxpayerInfo.taxpayer_id == taxpayer_id,
    ).first()
    if not item:
        return None
    return {
        "taxpayer_id": item.taxpayer_id,
        "company_name": item.company_name,
        "industry": item.industry,
        "region": item.region,
        "tax_bureau": item.tax_bureau,
        "manager_department": item.manager_department,
        "tax_officer": item.tax_officer,
        "credit_rating": item.credit_rating,
        "risk_level": item.risk_level,
        "registration_status": item.registration_status,
    }


# --- Routes ---
@router.post("/tasks", response_model=TaskCreatedResponse)
def create_task(
    body: TaskCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task_id = make_task_id()
    task = Task(
        task_id=task_id,
        name=body.name,
        type="analysis",
        status="queued",
        module="analysis-workbench",
        creator_id=current_user.id,
        result_summary="任务已创建，等待处理",
        taxpayer_id=body.taxpayer_id.strip(),
        company_name=body.company_name.strip(),
    )
    db.add(task)
    log_action(db, "create", task_id, current_user.id, detail=f"创建分析任务: {body.name}")
    db.commit()
    return TaskCreatedResponse(success=True, message="任务已创建", task_id=task_id)


@router.get("/tasks", response_model=TaskListResponse)
def list_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Task).filter(Task.module == "analysis-workbench", Task.creator_id == current_user.id)
    total = q.count()
    tasks = q.order_by(Task.created_at.desc()).limit(50).all()
    items = []
    for t in tasks:
        file_count = db.query(FileRecord).filter(
            FileRecord.module == "analysis-workbench",
            FileRecord.name.like(f"{t.task_id}%")
        ).count()
        items.append(TaskItem(
            id=t.id,
            task_id=t.task_id,
            name=t.name,
            description=t.result_summary or "",
            status=t.status,
            file_count=file_count,
            created_at=t.created_at,
        ))
    return TaskListResponse(tasks=items, total=total)


@router.get("/tasks/{task_id}", response_model=TaskDetailResponse)
def get_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.task_id == task_id, Task.creator_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    report = build_report_payload(task, db, current_user.id)
    files = get_task_files(task_id, db, current_user.id)
    analysis = analyze_files(task, files) if files else {
        "company_name": "",
        "taxpayer_id": "",
        "periods": [],
        "risk_count": 0,
        "risks": [],
        "material_gap_list": [],
        "data_warnings": [],
    }
    analysis = enrich_analysis_review_state(analysis, task_id, db, current_user.id)
    taxpayer_profile = get_taxpayer_profile(analysis.get("taxpayer_id", ""), db, current_user.id)
    log_count = db.query(OperationLog).filter(
        OperationLog.module == "analysis-workbench",
        OperationLog.operator_id == current_user.id,
        OperationLog.target_id == task_id,
    ).count()
    return TaskDetailResponse(
        id=task.id,
        task_id=task.task_id,
        name=task.name,
        description=task.result_summary or "",
        status=task.status,
        result_summary=task.result_summary or "",
        file_count=report.file_count,
        files=[item.original_name for item in files],
        related_record_count=report.related_record_count,
        related_record_ids=report.related_record_ids,
        log_count=log_count,
        company_name=analysis["company_name"] or "",
        taxpayer_id=analysis["taxpayer_id"] or "",
        periods=analysis["periods"],
        risk_count=analysis["risk_count"],
        risks=analysis["risks"],
        material_gap_list=analysis.get("material_gap_list", []),
        taxpayer_profile=taxpayer_profile,
        data_warnings=analysis["data_warnings"],
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
    )


@router.get("/tasks/{task_id}/report")
def export_report(
    task_id: str,
    format: str = Query("json"),
    doc_type: str = Query("analysis"),
    agency_name: str = Query(""),
    document_number: str = Query(""),
    contact_person: str = Query(""),
    contact_phone: str = Query(""),
    rectification_deadline: str = Query(""),
    document_date: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.task_id == task_id, Task.creator_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    report = build_report_payload(task, db, current_user.id)
    files = get_task_files(task_id, db, current_user.id)
    analysis = analyze_files(task, files) if files else analyze_files(task, [])
    filename_safe_task_id = task.task_id.replace("/", "-")

    document_config = get_document_settings(db, current_user.id)
    for key, value in {
        "agency_name": agency_name,
        "document_number": document_number,
        "contact_person": contact_person,
        "contact_phone": contact_phone,
        "rectification_deadline": rectification_deadline,
        "document_date": document_date,
    }.items():
        if str(value or "").strip():
            document_config[key] = value

    if doc_type == "notice":
        payload = apply_document_config(analysis["notice"], document_config)
        txt_content = render_notice_text(payload)
        suffix = "notice"
    elif doc_type == "analysis":
        payload = apply_document_config(analysis["analysis_report"], document_config)
        txt_content = render_officer_report_text(payload)
        suffix = "analysis"
    else:
        raise HTTPException(status_code=400, detail="仅支持 analysis 或 notice 类型")

    if format == "json":
        content = json.dumps(payload, ensure_ascii=False, indent=2)
        media_type = "application/json"
        extension = "json"
    elif format == "txt":
        header = [
            f"任务名称: {report.name}",
            f"分析编号: {report.task_id}",
            f"状态: {report.status}",
            f"创建时间: {report.created_at}",
            f"完成时间: {report.completed_at or '—'}",
            f"文件数: {report.file_count}",
            f"形成风险事项数: {report.related_record_count}",
            f"风险数: {report.risk_count}",
            "",
            "任务摘要:",
            report.result_summary or "无",
            "",
        ]
        content = "\n".join(header) + txt_content
        media_type = "text/plain; charset=utf-8"
        extension = "txt"
    elif format == "docx":
        if doc_type == "notice":
            content = render_notice_docx(payload)
        else:
            content = render_officer_report_docx(payload)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        extension = "docx"
    else:
        raise HTTPException(status_code=400, detail="仅支持 json、txt 或 docx 格式")

    log_action(
        db,
        "export",
        task_id,
        current_user.id,
        detail=f"导出分析报告 ({doc_type}/{format})",
    )
    db.commit()

    filename = f"{filename_safe_task_id}-{suffix}.{extension}"
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}",
        },
    )


@router.post("/tasks/{task_id}/cancel")
def cancel_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.task_id == task_id, Task.creator_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    task.status = "cancelled"
    log_action(db, "update", task_id, current_user.id, detail="取消分析任务")
    db.commit()
    return {"success": True, "message": "任务已取消"}


@router.post("/tasks/{task_id}/run")
def run_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """基于已上传文件执行轻量分析并生成结果摘要。"""
    task = db.query(Task).filter(Task.task_id == task_id, Task.creator_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status not in ("queued",):
        raise HTTPException(status_code=400, detail=f"当前状态无法发起: {task.status}")

    files = get_task_files(task_id, db, current_user.id)
    if not files:
        raise HTTPException(status_code=400, detail="请先上传至少一个分析文件")

    task.status = "running"
    task.result_summary = "分析执行中..."
    log_action(db, "create", task_id, current_user.id, detail="发起分析任务")
    db.commit()
    try:
        analysis = analyze_files(task, files)
        generated_records = analysis["generated_records"]

        task.status = "succeeded"
        task.result_summary = analysis["summary"]
        task.completed_at = datetime.utcnow()

        from app.models.notification import Notification
        created_count = 0
        for item in generated_records:
            rec = Record(
                record_id=f"rec-{secrets.token_hex(6)}",
                name=item["name"],
                category=item["category"],
                assignee="",
                status="pending_review",
                tags=item["tags"],
                detail=item["detail"],
                import_batch=f"analysis-{task_id}",
                owner_id=current_user.id,
            )
            db.add(rec)
            db.flush()
            created_count += 1
            db.add(CrossLinkLog(
                source_module="analysis-workbench",
                source_type="task",
                source_id=task_id,
                target_module="record-operations",
                target_type="record",
                target_id=rec.record_id,
                operator_id=current_user.id,
            ))

        notif = Notification(
            title="案头分析完成",
            content=f'案头分析 "{task.name}" 已完成，处理 {len(files)} 个文件，识别 {analysis["risk_count"]} 项风险，形成 {created_count} 条风险事项。分析编号: {task.task_id}',
            type="success",
            user_id=current_user.id,
        )
        db.add(notif)
        log_action(db, "update", task_id, current_user.id, detail=f"分析执行完成，识别 {analysis['risk_count']} 项风险，生成 {created_count} 条对象结果")
        db.commit()
    except Exception as exc:
        task.status = "failed"
        task.result_summary = f"分析失败：{exc}"
        task.completed_at = datetime.utcnow()
        from app.models.notification import Notification
        notif = Notification(
            title="分析任务失败",
            content=f'任务 "{task.name}" 执行失败：{exc}',
            type="error",
            user_id=current_user.id,
        )
        db.add(notif)
        log_action(db, "update", task_id, current_user.id, detail=f"分析执行失败", result="failed")
        db.commit()
        raise HTTPException(status_code=500, detail=f"分析执行失败：{exc}") from exc

    try:
        from app.services.webhook import WebhookService
        WebhookService.trigger("task.completed", {
            "task_id": task.task_id,
            "name": task.name,
            "status": "succeeded",
            "result_summary": task.result_summary,
            "creator_id": current_user.id,
        })
    except Exception:
        pass

    return {"success": True, "message": "分析已完成"}


@router.post("/tasks/{task_id}/risks/{record_id}/review")
def update_risk_review(
    task_id: str,
    record_id: str,
    body: RiskReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_statuses = {"pending_review", "confirmed", "false_positive", "rectified", "transferred"}
    if body.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="不支持的复核状态")

    record = db.query(Record).filter(
        Record.record_id == record_id,
        Record.owner_id == current_user.id,
        Record.import_batch == f"analysis-{task_id}",
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="风险对象不存在")

    record.status = body.status
    if body.note:
        record.detail = f"{record.detail}\n复核备注：{body.note}"
    log_action(db, "update", task_id, current_user.id, detail=f"更新风险复核状态: {record_id} -> {body.status}")
    db.commit()
    return {"success": True, "record_id": record_id, "status": body.status}


@router.post("/risks/{risk_id}/ledger", response_model=LedgerSyncResponse)
def sync_risk_to_ledger(
    risk_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(Record).filter(
        Record.record_id == risk_id,
        Record.owner_id == current_user.id,
    ).first()
    if not record or not record.import_batch.startswith("analysis-"):
        raise HTTPException(status_code=404, detail="未找到可记入台账的分析风险")

    task_id = record.import_batch[len("analysis-"):]
    task = db.query(Task).filter(Task.task_id == task_id, Task.creator_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="来源分析任务不存在")

    files = get_task_files(task_id, db, current_user.id)
    analysis = enrich_analysis_review_state(analyze_files(task, files), task_id, db, current_user.id)
    matched = next((risk for risk in analysis.get("risks", []) if risk.get("review_record_id") == risk_id), None)
    if not matched:
        raise HTTPException(status_code=404, detail="来源风险明细不存在")
    taxpayer_id = analysis.get("taxpayer_id", "")
    if not taxpayer_id:
        raise HTTPException(status_code=400, detail="未识别纳税人识别号，无法记入台账")

    content = f"{matched.get('risk_type', '涉税风险')}：{matched.get('issue', record.detail or '')}"
    note_parts = []
    if matched.get("evidence"):
        note_parts.append("涉及数据：" + "；".join(matched.get("evidence", [])))
    if matched.get("verification_focus"):
        note_parts.append("核查方向：" + matched["verification_focus"])
    if matched.get("required_materials"):
        note_parts.append("应调取资料：" + "、".join(matched.get("required_materials", [])))
    existing_entry = db.query(RiskLedgerEntry).filter(
        RiskLedgerEntry.owner_id == current_user.id,
        RiskLedgerEntry.taxpayer_id == taxpayer_id,
        RiskLedgerEntry.content == content,
    ).first()
    if existing_entry:
        return LedgerSyncResponse(success=True, message="该风险已在风险记录台账中", entry_id=existing_entry.entry_id)
    entry = create_entry(EntryCreateRequest(
        taxpayer_id=taxpayer_id,
        company_name=analysis.get("company_name", ""),
        recorded_at=datetime.utcnow(),
        content=content,
        entry_status="待核实",
        rectification_deadline=datetime.utcnow() + timedelta(days=7),
        contact_person="主管税务人员",
        note="\n".join(note_parts),
    ), db, current_user)
    log_action(db, "create", entry.entry_id, current_user.id, module="risk-ledger", detail=f"分析风险记入台账: {risk_id}")
    db.commit()
    return LedgerSyncResponse(success=True, message="已记入风险记录台账", entry_id=entry.entry_id)


@router.post("/tasks/{task_id}/rerun", response_model=TaskCreatedResponse)
def rerun_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source_task = db.query(Task).filter(
        Task.task_id == task_id,
        Task.creator_id == current_user.id,
        Task.module == "analysis-workbench",
    ).first()
    if not source_task:
        raise HTTPException(status_code=404, detail="任务不存在")

    source_files = db.query(FileRecord).filter(
        FileRecord.module == "analysis-workbench",
        FileRecord.owner_id == current_user.id,
        FileRecord.name.like(f"{task_id}%"),
    ).order_by(FileRecord.created_at.asc()).all()
    if not source_files:
        raise HTTPException(status_code=400, detail="原任务没有可重跑的文件")

    new_task_id = make_task_id()
    new_task = Task(
        task_id=new_task_id,
        name=f"{source_task.name}（重跑）",
        type="analysis",
        status="queued",
        module="analysis-workbench",
        creator_id=current_user.id,
        result_summary=f"基于任务 {task_id} 重建，等待处理",
    )
    db.add(new_task)
    db.flush()

    for source_file in source_files:
        stored_suffix = source_file.name.split(":", 1)[-1]
        db.add(FileRecord(
            file_id=f"file-{secrets.token_hex(8)}",
            name=f"{new_task_id}:{stored_suffix}",
            original_name=source_file.original_name,
            module="analysis-workbench",
            owner_id=current_user.id,
            size=source_file.size,
            mime_type=source_file.mime_type,
            path=source_file.path,
            status=source_file.status,
        ))

    log_action(db, "create", new_task_id, current_user.id, detail=f"重跑分析任务，来源: {task_id}")
    db.commit()
    return TaskCreatedResponse(success=True, message="已创建重跑任务", task_id=new_task_id)


@router.post("/upload", response_model=UploadResponse)
def upload_file(
    task_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.task_id == task_id, Task.creator_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    content = file.file.read()
    saved = save_upload(content, file.filename or "unknown", "analysis-workbench")

    file_record = FileRecord(
        file_id=f"file-{secrets.token_hex(8)}",
        name=f"{task_id}:{saved['stored_name']}",
        original_name=saved["original_name"],
        module="analysis-workbench",
        owner_id=current_user.id,
        size=saved["size"],
        mime_type=file.content_type or "application/octet-stream",
        path=saved["path"],
    )
    db.add(file_record)
    log_action(db, "import", task_id, current_user.id,
               detail=f"上传文件: {saved['original_name']}")
    db.commit()
    profile = profile_file(file_record)
    return {"success": True, "message": "上传成功", "file_id": file_record.file_id, "profile": profile}


@router.post("/tasks/{task_id}/manual-data", response_model=UploadResponse)
def add_manual_data(
    task_id: str,
    body: ManualDataRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.task_id == task_id, Task.creator_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if body.data_kind not in {"vat_return", "cit_return", "pit_return"}:
        raise HTTPException(status_code=400, detail="仅支持补录增值税、企业所得税、个人所得税申报数据")
    if not body.rows:
        raise HTTPException(status_code=400, detail="请至少补录一行数据")

    normalized_rows = []
    for row in body.rows:
        item = dict(row)
        item["data_kind"] = body.data_kind
        normalized_rows.append(item)

    content = json.dumps({"rows": normalized_rows}, ensure_ascii=False, indent=2).encode("utf-8")
    saved = save_upload(content, f"manual_{body.data_kind}_{datetime.now().strftime('%Y%m%d%H%M%S')}.json", "analysis-workbench")
    file_record = FileRecord(
        file_id=f"file-{secrets.token_hex(8)}",
        name=f"{task_id}:{saved['stored_name']}",
        original_name=saved["original_name"],
        module="analysis-workbench",
        owner_id=current_user.id,
        size=saved["size"],
        mime_type="application/json",
        path=saved["path"],
    )
    db.add(file_record)
    log_action(db, "import", task_id, current_user.id, detail=f"手工补录申报数据: {body.data_kind}")
    db.commit()
    profile = profile_file(file_record)
    return {"success": True, "message": "补录成功", "file_id": file_record.file_id, "profile": profile}
