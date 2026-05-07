from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Session as SessionModel
from app.models import User
from app.models.permission import ROLE_PERMISSIONS
from app.routers.auth import require_permission
from app.services.audit import log_action
from app.services.auth import hash_password

router = APIRouter(prefix="/api/platform/users", tags=["账号管理"])


class UserSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    nickname: str
    role: str
    is_active: bool
    must_change_password: bool = False
    created_at: datetime


class UserListResponse(BaseModel):
    users: List[UserSchema]


class UserCreateRequest(BaseModel):
    username: str
    password: str
    nickname: str = ""
    role: str = "user"


class UserUpdateRequest(BaseModel):
    nickname: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class PasswordResetRequest(BaseModel):
    new_password: str


def validate_role(role: str) -> str:
    role = (role or "user").strip()
    if role not in ROLE_PERMISSIONS:
        raise HTTPException(status_code=400, detail="角色不存在")
    return role


def validate_password(password: str):
    if len(password or "") < 8:
        raise HTTPException(status_code=400, detail="密码至少需要 8 位")


@router.get("", response_model=UserListResponse)
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("platform:user:manage")),
):
    _ = current_user
    users = db.query(User).order_by(User.created_at.desc(), User.id.desc()).all()
    return UserListResponse(users=users)


@router.post("", response_model=UserSchema)
def create_user(
    body: UserCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("platform:user:manage")),
):
    username = body.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="请输入用户名")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")
    validate_password(body.password)
    role = validate_role(body.role)
    user = User(
        username=username,
        hashed_password=hash_password(body.password),
        nickname=body.nickname.strip() or username,
        role=role,
        is_active=True,
        must_change_password=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    log_action(db, "create_user", str(user.id), current_user.id, f"创建账号: {user.username} ({role})", module="auth", request=request)
    return user


@router.put("/{user_id}", response_model=UserSchema)
def update_user(
    user_id: int,
    body: UserUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("platform:user:manage")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="账号不存在")
    if body.nickname is not None:
        user.nickname = body.nickname.strip() or user.username
    if body.role is not None:
        user.role = validate_role(body.role)
    if body.is_active is not None:
        if user.id == current_user.id and body.is_active is False:
            raise HTTPException(status_code=400, detail="不能停用当前登录账号")
        old_status = user.is_active
        user.is_active = body.is_active
        if not user.is_active:
            db.query(SessionModel).filter(SessionModel.user_id == user.id, SessionModel.is_valid == True).update({"is_valid": False})
    db.commit()
    db.refresh(user)
    status_detail = "；停用账号" if body.is_active is False else "；启用账号" if body.is_active is True else ""
    if body.is_active is not None and old_status == body.is_active:
        status_detail = "；账号状态未变化"
    log_action(db, "update_user", str(user.id), current_user.id, f"更新账号: {user.username}{status_detail}", module="auth", request=request)
    return user


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    body: PasswordResetRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("platform:user:manage")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="账号不存在")
    validate_password(body.new_password)
    user.hashed_password = hash_password(body.new_password)
    user.must_change_password = True
    db.query(SessionModel).filter(SessionModel.user_id == user.id, SessionModel.is_valid == True).update({"is_valid": False})
    db.commit()
    log_action(db, "reset_password", str(user.id), current_user.id, f"重置账号密码: {user.username}", module="auth", request=request)
    return {"success": True, "message": "密码已重置，该账号需要重新登录"}
