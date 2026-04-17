import secrets, csv, io
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models import User
from app.models.record import FileRecord, OperationLog
from app.models.records import Record
from app.routers.auth import get_current_user
from app.services.file_service import save_upload

router = APIRouter(prefix="/api/modules/record-operations", tags=["对象管理模块"])


def log_action(db: Session, action: str, target_id: str, operator_id: int,
               detail: str = "", result: str = "success"):
    db.add(OperationLog(
        action=action,
        target_type="Record",
        target_id=target_id,
        module="record-operations",
        operator_id=operator_id,
        detail=detail,
        result=result,
    ))


# --- Schemas ---
class RecordSchema(BaseModel):
    id: int
    record_id: str
    name: str
    category: str
    assignee: str
    status: str
    tags: str
    detail: str
    import_batch: str
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RecordListResponse(BaseModel):
    records: list[RecordSchema]
    total: int


class RecordCreateRequest(BaseModel):
    name: str
    category: str = ""
    assignee: str = ""
    tags: str = ""
    detail: str = ""


class RecordUpdateRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    assignee: Optional[str] = None
    tags: Optional[str] = None
    detail: Optional[str] = None
    status: Optional[str] = None


class BatchRequest(BaseModel):
    record_ids: list[str]
    category: Optional[str] = None
    assignee: Optional[str] = None
    status: Optional[str] = None


# --- Routes ---
@router.get("/records", response_model=RecordListResponse)
def list_records(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    assignee: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Record).filter(Record.owner_id == current_user.id)
    if category:
        query = query.filter(Record.category == category)
    if status:
        query = query.filter(Record.status == status)
    if assignee:
        query = query.filter(Record.assignee.like(f"%{assignee}%"))
    if q:
        query = query.filter(Record.name.like(f"%{q}%"))
    total = query.count()
    records = query.order_by(Record.created_at.desc()).offset(offset).limit(limit).all()
    return RecordListResponse(records=records, total=total)


@router.post("/records", response_model=RecordSchema)
def create_record(
    body: RecordCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record_id = f"rec-{secrets.token_hex(6)}"
    record = Record(
        record_id=record_id,
        name=body.name,
        category=body.category,
        assignee=body.assignee,
        tags=body.tags,
        detail=body.detail,
        owner_id=current_user.id,
    )
    db.add(record)
    log_action(db, "create", record_id, current_user.id, detail=f"创建对象: {body.name}")
    db.commit()
    db.refresh(record)
    return record


@router.get("/records/{record_id}", response_model=RecordSchema)
def get_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(Record).filter(Record.record_id == record_id, Record.owner_id == current_user.id).first()
    if not r:
        raise HTTPException(status_code=404, detail="对象不存在")
    return r


@router.put("/records/{record_id}", response_model=RecordSchema)
def update_record(
    record_id: str,
    body: RecordUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(Record).filter(Record.record_id == record_id, Record.owner_id == current_user.id).first()
    if not r:
        raise HTTPException(status_code=404, detail="对象不存在")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(r, field, value)
    log_action(db, "update", record_id, current_user.id, detail=f"修改对象: {r.name}")
    db.commit()
    db.refresh(r)
    return r


@router.post("/records/{record_id}/delete")
def delete_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    r = db.query(Record).filter(Record.record_id == record_id, Record.owner_id == current_user.id).first()
    if not r:
        raise HTTPException(status_code=404, detail="对象不存在")
    r.status = "archived"
    log_action(db, "delete", record_id, current_user.id, detail=f"归档对象: {r.name}")
    db.commit()
    return {"success": True, "message": "对象已归档"}


@router.post("/records/{record_id}/tags")
def update_tags(
    record_id: str,
    body: BatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新标签（批量）"""
    records = db.query(Record).filter(
        Record.record_id.in_(body.record_ids),
        Record.owner_id == current_user.id,
    ).all()
    updated = 0
    for r in records:
        if body.assignee is not None:
            r.tags = body.assignee  # reuse assignee field as tags placeholder
        log_action(db, "update", r.record_id, current_user.id, detail=f"更新标签: {r.name}")
        updated += 1
    db.commit()
    return {"success": True, "message": f"已更新 {updated} 条记录"}


@router.get("/records/tags/suggestions")
def tag_suggestions(
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取标签建议（去重）"""
    query = db.query(Record.tags).filter(
        Record.owner_id == current_user.id,
        Record.tags.isnot(None),
        Record.tags != "",
    )
    if q:
        query = query.filter(Record.tags.like(f"%{q}%"))
    all_tags = set()
    for (tag_str,) in query.distinct().all():
        if tag_str:
            for tag in tag_str.split(","):
                tag = tag.strip()
                if tag:
                    all_tags.add(tag)
    return {"tags": sorted(all_tags)[:50]}


@router.post("/records/batch-delete")
def batch_delete(
    body: BatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """批量彻底删除（需确认）"""
    if not body.record_ids:
        raise HTTPException(status_code=400, detail="未提供要删除的记录ID")
    records = db.query(Record).filter(
        Record.record_id.in_(body.record_ids),
        Record.owner_id == current_user.id,
    ).all()
    deleted = 0
    for r in records:
        db.delete(r)
        deleted += 1
    db.commit()
    return {"success": True, "message": f"已彻底删除 {deleted} 条记录"}


@router.post("/batch-update")
def batch_update(
    body: BatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    records = db.query(Record).filter(
        Record.record_id.in_(body.record_ids),
        Record.owner_id == current_user.id,
    ).all()
    updated = 0
    for r in records:
        if body.category is not None:
            r.category = body.category
        if body.assignee is not None:
            r.assignee = body.assignee
        if body.status is not None:
            r.status = body.status
        log_action(db, "update", r.record_id, current_user.id, detail=f"批量修改对象: {r.name}")
        updated += 1
    db.commit()
    return {"success": True, "message": f"已更新 {updated} 条记录"}


@router.post("/import")
def import_records(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import_batch = f"import-{datetime.now().strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(4)}"
    content = file.file.read()

    # Save file
    saved = save_upload(content, file.filename or "import.csv", "record-operations")
    file_record = FileRecord(
        file_id=f"file-{secrets.token_hex(8)}",
        name=f"{import_batch}:{saved['stored_name']}",
        original_name=saved["original_name"],
        module="record-operations",
        owner_id=current_user.id,
        size=saved["size"],
        mime_type=file.content_type or "text/csv",
        path=saved["path"],
    )
    db.add(file_record)

    # Parse CSV
    decoded = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))
    imported = 0
    for row in reader:
        name = row.get("name", "").strip()
        if not name:
            continue
        record = Record(
            record_id=f"rec-{secrets.token_hex(6)}",
            name=name,
            category=row.get("category", "").strip(),
            assignee=row.get("assignee", "").strip(),
            tags=row.get("tags", "").strip(),
            detail=row.get("detail", "").strip(),
            import_batch=import_batch,
            owner_id=current_user.id,
        )
        db.add(record)
        imported += 1

    log_action(db, "import", import_batch, current_user.id, detail=f"导入 {imported} 条对象记录")
    db.commit()
    return {"success": True, "message": f"成功导入 {imported} 条记录", "batch": import_batch}


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = db.query(Record).filter(Record.owner_id == current_user.id).count()
    active = db.query(Record).filter(Record.owner_id == current_user.id, Record.status == "active").count()
    categories = db.query(Record.category).filter(Record.owner_id == current_user.id, Record.category != "").distinct().count()
    return {"total": total, "active": active, "categories": categories}
