from datetime import datetime, timedelta
from typing import Optional

import csv
import io
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User
from app.models.record import Task
from app.models.risk_ledger import RiskDossier, RiskLedgerEntry
from app.models.taxpayer import TaxpayerInfo
from app.modules.analysis_router import get_task_files
from app.routers.auth import get_current_user
from app.services.tax_analysis import analyze_files

router = APIRouter(prefix="/api/workbench", tags=["税源管理员工作台"])


class TaxpayerWorkbenchResponse(BaseModel):
    taxpayer: dict
    dossier: Optional[dict] = None
    entries: list[dict] = []
    recent_analysis_tasks: list[dict] = []
    latest_risk: Optional[dict] = None
    material_gap_list: list[str] = []


class RiskListResponse(BaseModel):
    items: list[dict]
    total: int
    summary: dict


class TodoResponse(BaseModel):
    items: list[dict]
    summary: dict


class TaxpayerSearchResponse(BaseModel):
    items: list[dict]


def dossier_payload(dossier: RiskDossier, db: Session) -> dict:
    taxpayer = db.query(TaxpayerInfo).filter(
        TaxpayerInfo.owner_id == dossier.owner_id,
        TaxpayerInfo.taxpayer_id == dossier.taxpayer_id,
    ).first()
    entries = db.query(RiskLedgerEntry).filter(
        RiskLedgerEntry.dossier_id == dossier.id,
        RiskLedgerEntry.owner_id == dossier.owner_id,
    ).order_by(RiskLedgerEntry.recorded_at.desc(), RiskLedgerEntry.id.desc()).all()
    latest = entries[0] if entries else None
    latest_deadline = latest.rectification_deadline if latest else None
    latest_recorded_at = latest.recorded_at if latest else None
    is_overdue = bool(
        latest
        and latest.entry_status == "整改中"
        and latest_deadline is not None
        and latest_deadline < datetime.utcnow()
    )
    return {
        "taxpayer_id": dossier.taxpayer_id,
        "company_name": dossier.company_name,
        "registration_status": dossier.registration_status,
        "tax_officer": dossier.tax_officer,
        "address": dossier.address,
        "industry": taxpayer.industry if taxpayer else "",
        "industry_tag": taxpayer.industry_tag if taxpayer else "",
        "address_tag": taxpayer.address_tag if taxpayer else "",
        "manager_department": taxpayer.manager_department if taxpayer else "",
        "is_temporary": dossier.is_temporary,
        "entry_count": len(entries),
        "latest_recorded_at": latest_recorded_at.isoformat() if latest_recorded_at else None,
        "latest_rectification_deadline": latest_deadline.isoformat() if latest_deadline else None,
        "latest_content": latest.content if latest else "",
        "latest_entry_status": latest.entry_status if latest else "",
        "latest_contact_person": latest.contact_person if latest else "",
        "latest_contact_phone": latest.contact_phone if latest else "",
        "is_overdue": is_overdue,
    }


def entry_payload(entry: RiskLedgerEntry) -> dict:
    return {
        "entry_id": entry.entry_id,
        "taxpayer_id": entry.taxpayer_id,
        "recorded_at": entry.recorded_at.isoformat() if entry.recorded_at else None,
        "content": entry.content,
        "entry_status": entry.entry_status,
        "rectification_deadline": entry.rectification_deadline.isoformat() if entry.rectification_deadline else None,
        "contact_person": entry.contact_person,
        "contact_phone": entry.contact_phone,
        "note": entry.note,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


def taxpayer_search_payload(item: TaxpayerInfo) -> dict:
    return {
        "taxpayer_id": item.taxpayer_id,
        "company_name": item.company_name,
        "registration_status": item.registration_status,
        "tax_officer": item.tax_officer,
        "address": item.address,
        "industry": item.industry,
        "industry_tag": item.industry_tag,
        "address_tag": item.address_tag,
        "tax_bureau": item.tax_bureau,
        "manager_department": item.manager_department,
        "legal_person": item.legal_person,
        "last_used_at": item.last_used_at.isoformat() if item.last_used_at else None,
    }


def recent_analysis_for_taxpayer(taxpayer_id: str, db: Session, user_id: int, limit: int = 5) -> tuple[list[dict], list[str]]:
    tasks = db.query(Task).filter(
        Task.creator_id == user_id,
        Task.module == "analysis-workbench",
    ).order_by(Task.created_at.desc()).limit(30).all()
    matched: list[dict] = []
    material_gaps: list[str] = []
    for task in tasks:
        files = get_task_files(task.task_id, db, user_id)
        if not files:
            continue
        analysis = analyze_files(task, files)
        if analysis.get("taxpayer_id") != taxpayer_id:
            continue
        matched.append({
            "task_id": task.task_id,
            "name": task.name,
            "status": task.status,
            "risk_count": analysis.get("risk_count", 0),
            "summary": analysis.get("summary", task.result_summary or ""),
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        })
        for item in analysis.get("material_gap_list", []):
            if item not in material_gaps:
                material_gaps.append(item)
        if len(matched) >= limit:
            break
    return matched, material_gaps


def build_risk_list_items(
    db: Session,
    user_id: int,
    q: Optional[str] = None,
    tax_officer: Optional[str] = None,
    registration_status: Optional[str] = None,
    entry_status: Optional[str] = None,
    overdue: Optional[bool] = None,
    temporary: Optional[bool] = None,
) -> tuple[list[dict], int]:
    query = db.query(RiskDossier).filter(RiskDossier.owner_id == user_id)
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
    if temporary is not None:
        query = query.filter(RiskDossier.is_temporary == temporary)
    rows = query.order_by(RiskDossier.updated_at.desc()).all()
    items = []
    for dossier in rows:
        item = dossier_payload(dossier, db)
        if entry_status and item["latest_entry_status"] != entry_status:
            continue
        if overdue is not None and item["is_overdue"] != overdue:
            continue
        items.append(item)
    return items, len(items)


def latest_dossier_by_taxpayer(db: Session, user_id: int) -> dict[str, RiskDossier]:
    rows = db.query(RiskDossier).filter(RiskDossier.owner_id == user_id).all()
    return {row.taxpayer_id: row for row in rows}


def build_taxpayer_record_items(
    db: Session,
    user_id: int,
    q: Optional[str] = None,
    tax_officer: Optional[str] = None,
    registration_status: Optional[str] = None,
    entry_status: Optional[str] = None,
    overdue: Optional[bool] = None,
    temporary: Optional[bool] = None,
    industry_tag: Optional[str] = None,
    address_tag: Optional[str] = None,
) -> tuple[list[dict], int, dict]:
    dossier_map = latest_dossier_by_taxpayer(db, user_id)
    query = db.query(TaxpayerInfo).filter(TaxpayerInfo.owner_id == user_id)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(
            TaxpayerInfo.taxpayer_id.like(like),
            TaxpayerInfo.company_name.like(like),
            TaxpayerInfo.legal_person.like(like),
            TaxpayerInfo.tax_officer.like(like),
            TaxpayerInfo.address.like(like),
        ))
    if tax_officer:
        query = query.filter(TaxpayerInfo.tax_officer.like(f"%{tax_officer}%"))
    if registration_status:
        query = query.filter(TaxpayerInfo.registration_status == registration_status)
    if industry_tag:
        query = query.filter(TaxpayerInfo.industry_tag == industry_tag)
    if address_tag:
        query = query.filter(TaxpayerInfo.address_tag == address_tag)
    taxpayers = query.order_by(TaxpayerInfo.last_used_at.desc().nullslast(), TaxpayerInfo.updated_at.desc()).all()

    items: list[dict] = []
    seen: set[str] = set()
    for taxpayer in taxpayers:
        dossier = dossier_map.get(taxpayer.taxpayer_id)
        if dossier:
            item = dossier_payload(dossier, db)
        else:
            item = {
                "taxpayer_id": taxpayer.taxpayer_id,
                "company_name": taxpayer.company_name,
                "registration_status": taxpayer.registration_status,
                "tax_officer": taxpayer.tax_officer,
                "address": taxpayer.address,
                "industry": taxpayer.industry,
                "industry_tag": taxpayer.industry_tag,
                "address_tag": taxpayer.address_tag,
                "manager_department": taxpayer.manager_department,
                "is_temporary": False,
                "entry_count": 0,
                "latest_recorded_at": None,
                "latest_rectification_deadline": None,
                "latest_content": "",
                "latest_entry_status": "",
                "latest_contact_person": "",
                "latest_contact_phone": "",
                "is_overdue": False,
            }
        if entry_status and item["latest_entry_status"] != entry_status:
            continue
        if overdue is not None and item["is_overdue"] != overdue:
            continue
        if temporary is not None and item["is_temporary"] != temporary:
            continue
        seen.add(item["taxpayer_id"])
        items.append(item)

    for dossier in dossier_map.values():
        if dossier.taxpayer_id in seen:
            continue
        item = dossier_payload(dossier, db)
        if q:
            like_text = q.strip()
            if like_text not in item["taxpayer_id"] and like_text not in item["company_name"] and like_text not in item["address"]:
                continue
        if tax_officer and tax_officer not in item["tax_officer"]:
            continue
        if registration_status and item["registration_status"] != registration_status:
            continue
        if industry_tag and item.get("industry_tag") != industry_tag:
            continue
        if address_tag and item.get("address_tag") != address_tag:
            continue
        if entry_status and item["latest_entry_status"] != entry_status:
            continue
        if overdue is not None and item["is_overdue"] != overdue:
            continue
        if temporary is not None and item["is_temporary"] != temporary:
            continue
        items.append(item)

    summary = {
        "taxpayer_total": db.query(TaxpayerInfo).filter(TaxpayerInfo.owner_id == user_id).count(),
        "dossier_total": len(dossier_map),
        "pending_count": sum(1 for item in items if item["latest_entry_status"] == "待核实"),
        "rectifying_count": sum(1 for item in items if item["latest_entry_status"] == "整改中"),
        "rectified_count": sum(1 for item in items if item["latest_entry_status"] == "已整改"),
        "excluded_count": sum(1 for item in items if item["latest_entry_status"] == "已排除"),
        "temporary_count": sum(1 for item in items if item["is_temporary"]),
    }
    return items, len(items), summary


@router.get("/taxpayer/{taxpayer_id}", response_model=TaxpayerWorkbenchResponse)
def taxpayer_workbench(
    taxpayer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    taxpayer = db.query(TaxpayerInfo).filter(
        TaxpayerInfo.owner_id == current_user.id,
        TaxpayerInfo.taxpayer_id == taxpayer_id,
    ).first()
    dossier = db.query(RiskDossier).filter(
        RiskDossier.owner_id == current_user.id,
        RiskDossier.taxpayer_id == taxpayer_id,
    ).first()
    if not taxpayer and not dossier:
        raise HTTPException(status_code=404, detail="未找到该纳税人，请改用企业名称、法人或管理员搜索")
    entries = []
    if dossier:
        entries = db.query(RiskLedgerEntry).filter(
            RiskLedgerEntry.owner_id == current_user.id,
            RiskLedgerEntry.dossier_id == dossier.id,
        ).order_by(RiskLedgerEntry.recorded_at.desc(), RiskLedgerEntry.id.desc()).limit(20).all()
    recent_tasks, material_gaps = recent_analysis_for_taxpayer(taxpayer_id, db, current_user.id)
    latest_risk = entry_payload(entries[0]) if entries else None
    if taxpayer:
        taxpayer.last_used_at = datetime.utcnow()
        db.commit()
    return TaxpayerWorkbenchResponse(
        taxpayer={
            "taxpayer_id": taxpayer_id,
            "company_name": taxpayer.company_name if taxpayer else dossier.company_name if dossier else "",
            "registration_status": taxpayer.registration_status if taxpayer else dossier.registration_status if dossier else "",
            "tax_officer": taxpayer.tax_officer if taxpayer else dossier.tax_officer if dossier else "",
            "address": taxpayer.address if taxpayer else dossier.address if dossier else "",
            "industry": taxpayer.industry if taxpayer else "",
            "industry_tag": taxpayer.industry_tag if taxpayer else "",
            "address_tag": taxpayer.address_tag if taxpayer else "",
            "tax_bureau": taxpayer.tax_bureau if taxpayer else "",
            "manager_department": taxpayer.manager_department if taxpayer else "",
        },
        dossier=dossier_payload(dossier, db) if dossier else None,
        entries=[entry_payload(item) for item in entries],
        recent_analysis_tasks=recent_tasks,
        latest_risk=latest_risk,
        material_gap_list=material_gaps,
    )


@router.get("/taxpayers/search", response_model=TaxpayerSearchResponse)
def search_taxpayers(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    like = f"%{q.strip()}%"
    taxpayers = db.query(TaxpayerInfo).filter(
        TaxpayerInfo.owner_id == current_user.id,
        or_(
            TaxpayerInfo.taxpayer_id.like(like),
            TaxpayerInfo.company_name.like(like),
            TaxpayerInfo.legal_person.like(like),
            TaxpayerInfo.tax_officer.like(like),
        ),
    ).order_by(TaxpayerInfo.updated_at.desc()).limit(limit).all()
    return TaxpayerSearchResponse(items=[taxpayer_search_payload(item) for item in taxpayers])


@router.get("/recent-taxpayers", response_model=TaxpayerSearchResponse)
def recent_taxpayers(
    limit: int = Query(8, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    taxpayers = db.query(TaxpayerInfo).filter(
        TaxpayerInfo.owner_id == current_user.id,
        TaxpayerInfo.last_used_at.isnot(None),
    ).order_by(TaxpayerInfo.last_used_at.desc()).limit(limit).all()
    return TaxpayerSearchResponse(items=[taxpayer_search_payload(item) for item in taxpayers])


@router.get("/taxpayer-records", response_model=RiskListResponse)
def taxpayer_records(
    q: Optional[str] = Query(None),
    tax_officer: Optional[str] = Query(None),
    registration_status: Optional[str] = Query(None),
    entry_status: Optional[str] = Query(None),
    overdue: Optional[bool] = Query(None),
    temporary: Optional[bool] = Query(None),
    industry_tag: Optional[str] = Query(None),
    address_tag: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    matched_items, total, summary = build_taxpayer_record_items(
        db, current_user.id, q, tax_officer, registration_status, entry_status, overdue, temporary, industry_tag, address_tag
    )
    return RiskListResponse(items=matched_items[offset:offset + limit], total=total, summary=summary)


@router.get("/my-risk-list", response_model=RiskListResponse)
def my_risk_list(
    q: Optional[str] = Query(None),
    tax_officer: Optional[str] = Query(None),
    registration_status: Optional[str] = Query(None),
    entry_status: Optional[str] = Query(None),
    overdue: Optional[bool] = Query(None),
    temporary: Optional[bool] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    matched_items, total = build_risk_list_items(
        db, current_user.id, q, tax_officer, registration_status, entry_status, overdue, temporary
    )
    items = matched_items[offset:offset + limit]
    all_dossiers = db.query(RiskDossier).filter(RiskDossier.owner_id == current_user.id).all()
    all_items = [dossier_payload(item, db) for item in all_dossiers]
    return RiskListResponse(
        items=items,
        total=total,
        summary={
            "dossier_total": len(all_items),
            "pending_count": sum(1 for item in all_items if item["latest_entry_status"] == "待核实"),
            "rectifying_count": sum(1 for item in all_items if item["latest_entry_status"] == "整改中"),
            "rectified_count": sum(1 for item in all_items if item["latest_entry_status"] == "已整改"),
            "excluded_count": sum(1 for item in all_items if item["latest_entry_status"] == "已排除"),
            "temporary_count": sum(1 for item in all_items if item["is_temporary"]),
        },
    )


@router.get("/todos", response_model=TodoResponse)
def workbench_todos(
    limit: int = Query(10, le=20),
    due_days: int = Query(7, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    due_cutoff = now + timedelta(days=due_days)
    dossiers = db.query(RiskDossier).filter(RiskDossier.owner_id == current_user.id).all()
    items: list[dict] = []
    summary = {
        "pending_today_count": 0,
        "due_soon_count": 0,
        "overdue_count": 0,
        "recent_risk_count": 0,
    }

    for dossier in dossiers:
        item = dossier_payload(dossier, db)
        latest_at = datetime.fromisoformat(item["latest_recorded_at"]) if item["latest_recorded_at"] else None
        deadline = datetime.fromisoformat(item["latest_rectification_deadline"]) if item["latest_rectification_deadline"] else None
        todo_type = ""
        todo_label = ""
        priority = 99

        if item["latest_entry_status"] == "整改中" and deadline and deadline < now:
            todo_type = "overdue"
            todo_label = "逾期未整改"
            priority = 1
            summary["overdue_count"] += 1
        elif item["latest_entry_status"] == "整改中" and deadline and now <= deadline <= due_cutoff:
            todo_type = "due_soon"
            todo_label = "即将到期整改"
            priority = 2
            summary["due_soon_count"] += 1
        elif item["latest_entry_status"] == "待核实" and latest_at and latest_at >= today_start:
            todo_type = "pending_today"
            todo_label = "今日待核实风险"
            priority = 3
            summary["pending_today_count"] += 1
        elif latest_at and latest_at >= now - timedelta(days=7):
            todo_type = "recent_risk"
            todo_label = "最近新增疑点"
            priority = 4
            summary["recent_risk_count"] += 1

        if todo_type:
            item["todo_type"] = todo_type
            item["todo_label"] = todo_label
            item["_priority"] = priority
            items.append(item)

    items.sort(key=lambda item: (item["_priority"], item.get("latest_rectification_deadline") or "", item.get("latest_recorded_at") or ""), reverse=False)
    cleaned = [{key: value for key, value in item.items() if key != "_priority"} for item in items[:limit]]
    return TodoResponse(items=cleaned, summary=summary)


@router.get("/my-risk-list/export")
def export_my_risk_list(
    q: Optional[str] = Query(None),
    tax_officer: Optional[str] = Query(None),
    registration_status: Optional[str] = Query(None),
    entry_status: Optional[str] = Query(None),
    overdue: Optional[bool] = Query(None),
    temporary: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, _ = build_risk_list_items(
        db, current_user.id, q, tax_officer, registration_status, entry_status, overdue, temporary
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["纳税人识别号", "纳税人名称", "登记状态", "管理员", "地址", "最新风险", "最新处理状态", "最后记录时间", "整改期限", "联系人", "联系电话", "是否逾期", "是否临时档案"])
    for item in items:
        writer.writerow([
            item["taxpayer_id"],
            item["company_name"],
            item["registration_status"],
            item["tax_officer"],
            item["address"],
            item["latest_content"],
            item["latest_entry_status"],
            item["latest_recorded_at"] or "",
            item["latest_rectification_deadline"] or "",
            item["latest_contact_person"] or "",
            item["latest_contact_phone"] or "",
            "是" if item["is_overdue"] else "否",
            "是" if item["is_temporary"] else "否",
        ])
    filename = quote(f"管户风险清单_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )
