import secrets
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models import User
from app.models.record import Task, FileRecord, OperationLog
from app.models.records import Record
from app.models.cross_link import CrossLinkLog
from app.routers.auth import get_current_user
from app.services.file_service import save_upload

router = APIRouter(prefix="/api/modules/analysis-workbench", tags=["分析工作模块"])


# --- Schemas ---
class TaskCreateRequest(BaseModel):
    name: str
    description: str = ""


class TaskItem(BaseModel):
    id: int
    task_id: str
    name: str
    description: str
    status: str
    file_count: int
    created_at: datetime

    class Config:
        from_attributes = True


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
    related_record_count: int = 0
    related_record_ids: List[str] = []
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]


class TaskCreatedResponse(BaseModel):
    success: bool
    message: str
    task_id: str


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
    file_count = db.query(FileRecord).filter(
        FileRecord.module == "analysis-workbench",
        FileRecord.name.like(f"{task.task_id}%")
    ).count()
    related = db.query(Record).filter(
        Record.import_batch.like(f"analysis-{task_id}%"),
        Record.owner_id == current_user.id,
    ).all()
    related_record_ids = [r.record_id for r in related]
    return TaskDetailResponse(
        id=task.id,
        task_id=task.task_id,
        name=task.name,
        description=task.result_summary or "",
        status=task.status,
        result_summary=task.result_summary or "",
        file_count=file_count,
        related_record_count=len(related),
        related_record_ids=related_record_ids,
        created_at=task.created_at,
        updated_at=task.updated_at,
        completed_at=task.completed_at,
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
    """模拟发起分析（实际由后台任务执行）"""
    task = db.query(Task).filter(Task.task_id == task_id, Task.creator_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status not in ("queued",):
        raise HTTPException(status_code=400, detail=f"当前状态无法发起: {task.status}")

    task.status = "running"
    task.result_summary = "分析执行中..."
    log_action(db, "create", task_id, current_user.id, detail="发起分析任务")
    db.commit()

    # 模拟分析完成（3秒后更新为成功）
    import threading
    def finish():
        import time; time.sleep(3)
        from app.models.notification import Notification
        with Session(bind=db.get_bind()) as s:
            t = s.query(Task).filter(Task.task_id == task_id).first()
            if t:
                t.status = "succeeded"
                t.result_summary = "分析完成。共处理 1 个文件，发现 3 条关键结论。"
                t.completed_at = datetime.utcnow()
                # 创建关联对象（联动示例：分析结果 → 对象管理）
                import secrets as sk
                for i, label in enumerate(["高价值线索", "中风险信号", "待核实项"]):
                    rec = Record(
                        record_id=f"rec-{sk.token_hex(6)}",
                        name=f"[{t.name}] {label}",
                        category="analysis-result",
                        assignee="",
                        status="active",
                        tags="analysis,auto-generated",
                        detail=f"来源于分析任务 {t.task_id}，标签：{label}",
                        import_batch=f"analysis-{task_id}",
                        owner_id=current_user.id,
                    )
                    s.add(rec)
                    s.flush()
                    # 写联动日志
                    link = CrossLinkLog(
                        source_module="analysis-workbench",
                        source_type="task",
                        source_id=task_id,
                        target_module="record-operations",
                        target_type="record",
                        target_id=rec.record_id,
                        operator_id=current_user.id,
                    )
                    s.add(link)
                # 发通知
                notif = Notification(
                    title="分析任务完成",
                    content=f'任务 "{t.name}" 已完成，发现 3 条关键结论，已同步至对象管理。',
                    type="success",
                    user_id=current_user.id,
                )
                s.add(notif)
                # 触发 webhook
                try:
                    from app.services.webhook import WebhookService
                    WebhookService.trigger("task.completed", {
                        "task_id": t.task_id,
                        "name": t.name,
                        "status": "succeeded",
                        "result_summary": t.result_summary,
                        "creator_id": current_user.id,
                    })
                except Exception:
                    pass
                s.commit()

    threading.Thread(target=finish, daemon=True).start()
    return {"success": True, "message": "分析已开始"}


@router.post("/upload")
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
    return {"success": True, "message": "上传成功", "file_id": file_record.file_id}
