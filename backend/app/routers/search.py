from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models import User
from app.models.record import Task, FileRecord, OperationLog
from app.models.module import Module
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/search", tags=["搜索"])


class SearchResult(BaseModel):
    type: str       # task / file / log / module
    id: str
    title: str
    subtitle: str
    url: str


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total: int


@router.get("", response_model=SearchResponse)
def global_search(
    q: str = Query(..., min_length=1, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    results: List[SearchResult] = []
    like = f"%{q}%"

    # Tasks
    tasks = db.query(Task).filter(
        Task.name.like(like),
        Task.creator_id == current_user.id,
    ).limit(5).all()
    for t in tasks:
        results.append(SearchResult(
            type="task",
            id=str(t.id),
            title=t.name,
            subtitle=f"[{t.status}] {t.type} · {t.module}",
            url=f"/tasks",
        ))

    # Files
    files = db.query(FileRecord).filter(
        FileRecord.original_name.like(like),
        FileRecord.owner_id == current_user.id,
    ).limit(5).all()
    for f in files:
        results.append(SearchResult(
            type="file",
            id=str(f.id),
            title=f.original_name,
            subtitle=f"{f.mime_type} · {f.module}",
            url=f"/files",
        ))

    # Logs
    logs = db.query(OperationLog).filter(
        OperationLog.detail.like(like),
        operator_id == current_user.id,
    ).limit(5).all()
    for l in logs:
        results.append(SearchResult(
            type="log",
            id=str(l.id),
            title=f"{l.action} - {l.target_type}",
            subtitle=l.detail[:50] if l.detail else "",
            url=f"/logs",
        ))

    # Modules
    modules = db.query(Module).filter(
        Module.name.like(like),
        Module.is_active == True,
    ).limit(5).all()
    for m in modules:
        results.append(SearchResult(
            type="module",
            id=str(m.id),
            title=m.name,
            subtitle=f"{m.type} · {m.status}",
            url=f"/modules/{m.key}",
        ))

    return SearchResponse(query=q, results=results, total=len(results))
