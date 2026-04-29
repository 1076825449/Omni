from datetime import datetime, timedelta
from typing import Optional

import csv
import io
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query, Response
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


def dossier_payload(dossier: RiskDossier, db: Session) -> dict:
    entries = db.query(RiskLedgerEntry).filter(
        RiskLedgerEntry.dossier_id == dossier.id,
        RiskLedgerEntry.owner_id == dossier.owner_id,
    ).order_by(RiskLedgerEntry.recorded_at.desc(), RiskLedgerEntry.id.desc()).all()
    latest = entries[0] if entries else None
    latest_deadline = latest.rectification_deadline if latest else None
    latest_recorded_at = latest.recorded_at if latest else None
    fallback_cutoff = datetime.utcnow() - timedelta(days=30)
    is_overdue = bool(
        latest
        and latest.entry_status == "整改中"
        and (
            (latest_deadline is not None and latest_deadline < datetime.utcnow())
            or (latest_deadline is None and latest_recorded_at is not None and latest_recorded_at < fallback_cutoff)
        )
    )
    return {
        "taxpayer_id": dossier.taxpayer_id,
        "company_name": dossier.company_name,
        "registration_status": dossier.registration_status,
        "tax_officer": dossier.tax_officer,
        "address": dossier.address,
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
    entries = []
    if dossier:
        entries = db.query(RiskLedgerEntry).filter(
            RiskLedgerEntry.owner_id == current_user.id,
            RiskLedgerEntry.dossier_id == dossier.id,
        ).order_by(RiskLedgerEntry.recorded_at.desc(), RiskLedgerEntry.id.desc()).limit(20).all()
    recent_tasks, material_gaps = recent_analysis_for_taxpayer(taxpayer_id, db, current_user.id)
    latest_risk = entry_payload(entries[0]) if entries else None
    return TaxpayerWorkbenchResponse(
        taxpayer={
            "taxpayer_id": taxpayer_id,
            "company_name": taxpayer.company_name if taxpayer else dossier.company_name if dossier else "",
            "registration_status": taxpayer.registration_status if taxpayer else dossier.registration_status if dossier else "",
            "tax_officer": taxpayer.tax_officer if taxpayer else dossier.tax_officer if dossier else "",
            "address": taxpayer.address if taxpayer else dossier.address if dossier else "",
            "industry": taxpayer.industry if taxpayer else "",
            "tax_bureau": taxpayer.tax_bureau if taxpayer else "",
            "manager_department": taxpayer.manager_department if taxpayer else "",
        },
        dossier=dossier_payload(dossier, db) if dossier else None,
        entries=[entry_payload(item) for item in entries],
        recent_analysis_tasks=recent_tasks,
        latest_risk=latest_risk,
        material_gap_list=material_gaps,
    )


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
