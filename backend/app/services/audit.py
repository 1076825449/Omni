"""
审计日志工具函数
记录操作审计上下文（IP / User-Agent）
"""
from typing import Optional, Dict, Any
from starlette.requests import Request
from app.models.record import OperationLog
from app.core.database import SessionLocal


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_user_agent(request: Request) -> str:
    return request.headers.get("user-agent", "unknown")


def log_action(
    db,
    action: str,
    target_id: str,
    operator_id: int,
    detail: str = None,
    result: str = "success",
    module: str = "system",
    request: Request = None,
    extra: Dict[str, Any] = None,
) -> OperationLog:
    """
    记录操作审计日志。

    Args:
        db: 数据库会话
        action: 操作类型 (create/update/delete/login/logout/...)
        target_id: 目标对象ID
        operator_id: 操作人用户ID
        detail: 操作详情描述
        result: 操作结果 (success/failed)
        module: 所属模块
        request: FastAPI 请求对象（用于提取 IP/User-Agent）
        extra: 额外扩展字段（JSON 序列化后存 detail）
    """
    import json as _json

    ip = get_client_ip(request) if request else "unknown"
    ua = get_user_agent(request) if request else "unknown"

    log_detail = detail or ""
    if extra:
        log_detail += f" [extra: {_json.dumps(extra)}]"

    log = OperationLog(
        action=action,
        target_type=module,
        target_id=str(target_id),
        module=module,
        operator_id=operator_id,
        detail=log_detail,
        result=result,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
