from datetime import datetime
from typing import Optional, List, Dict, Any
from functools import wraps
from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, Request
from sqlalchemy.orm import Session as SASession
from app.core.database import get_db
from app.core.config import SESSION_COOKIE_NAME, SESSION_EXPIRE_SECONDS, AUTH_COOKIE_SECURE
from app.models import User, Session as SessionModel, Role
from app.models.permission import ROLE_PERMISSIONS, ALL_PERMISSIONS
from app.schemas.schemas import ChangePasswordRequest, LoginRequest, LoginResponse, LogoutResponse, UserInfo
from app.services.audit import log_action
from app.services.auth import (
    hash_password,
    verify_password,
    password_needs_rehash,
    create_session_id,
    make_expires_at,
)

router = APIRouter(prefix="/api/auth", tags=["认证"])


def get_current_user(
    session_id: Optional[str] = Cookie(None, alias=SESSION_COOKIE_NAME),
    db: SASession = Depends(get_db),
) -> User:
    """返回当前登录用户，未登录则 raise 401"""
    if not session_id:
        raise HTTPException(status_code=401, detail="未登录")
    session = db.query(SessionModel).filter(
        SessionModel.session_id == session_id,
        SessionModel.is_valid == True,
    ).first()
    if not session:
        raise HTTPException(status_code=401, detail="未登录")
    if session.expires_at < datetime.utcnow():
        session.is_valid = False
        db.commit()
        raise HTTPException(status_code=401, detail="会话已过期")
    user = db.query(User).filter(User.id == session.user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在或已禁用")
    return user


def get_optional_user(
    session_id: Optional[str] = Cookie(None, alias=SESSION_COOKIE_NAME),
    db: SASession = Depends(get_db),
) -> Optional[User]:
    """可选当前用户（用于 /me 等端点）"""
    if not session_id:
        return None
    session = db.query(SessionModel).filter(
        SessionModel.session_id == session_id,
        SessionModel.is_valid == True,
    ).first()
    if not session:
        return None
    if session.expires_at < datetime.utcnow():
        session.is_valid = False
        db.commit()
        return None
    user = db.query(User).filter(User.id == session.user_id, User.is_active == True).first()
    return user


def get_user_permissions(user: User) -> List[str]:
    """根据用户角色获取权限列表"""
    return ROLE_PERMISSIONS.get(user.role, []) if user else []


def require_permission(permission: str):
    """依赖项：检查用户是否拥有指定权限"""
    def dependency(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if not current_user:
            raise HTTPException(status_code=401, detail="未登录")
        perms = get_user_permissions(current_user)
        if permission not in perms:
            raise HTTPException(status_code=403, detail="权限不足")
        return current_user
    return dependency


@router.post("/login", response_model=LoginResponse)
def login(
    body: LoginRequest,
    response: Response,
    request: Request,
    db: SASession = Depends(get_db),
):
    """登录接口。传入用户名和密码，成功返回 session cookie。"""
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已被禁用")
    if password_needs_rehash(user.hashed_password):
        user.hashed_password = hash_password(body.password)

    sid = create_session_id()
    session = SessionModel(
        session_id=sid,
        user_id=user.id,
        expires_at=make_expires_at(),
    )
    db.add(session)
    db.commit()
    log_action(
        db,
        action="login",
        target_id=str(user.id),
        operator_id=user.id,
        detail=f"用户登录: {user.username}",
        module="auth",
        request=request,
    )

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=sid,
        httponly=True,
        samesite="lax",
        max_age=SESSION_EXPIRE_SECONDS,
        secure=AUTH_COOKIE_SECURE,
    )
    return LoginResponse(
        success=True,
        message="登录成功",
        user={
            "id": user.id,
            "username": user.username,
            "nickname": user.nickname,
            "role": user.role,
        },
    )


@router.post("/logout", response_model=LogoutResponse)
def logout(
    response: Response,
    request: Request,
    session_id: Optional[str] = Cookie(None, alias=SESSION_COOKIE_NAME),
    db: SASession = Depends(get_db),
):
    """退出登录。清除 session cookie。"""
    if session_id:
        session = db.query(SessionModel).filter(SessionModel.session_id == session_id).first()
        if session:
            log_action(
                db,
                action="logout",
                target_id=str(session.user_id),
                operator_id=session.user_id,
                detail="用户退出登录",
                module="auth",
                request=request,
            )
            session.is_valid = False
            db.commit()
    response.delete_cookie(SESSION_COOKIE_NAME)
    return LogoutResponse(success=True, message="已退出登录")


@router.get("/me", response_model=Optional[UserInfo])
def get_me(current_user: Optional[User] = Depends(get_optional_user)):
    """获取当前登录用户信息。未登录返回 null。"""
    if not current_user:
        return None
    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        nickname=current_user.nickname,
        role=current_user.role,
    )


@router.get("/me/permissions")
def get_my_permissions(current_user: User = Depends(get_current_user)):
    """获取当前用户权限列表"""
    if not current_user:
        raise HTTPException(status_code=401, detail="未登录")
    return {
        "role": current_user.role,
        "permissions": get_user_permissions(current_user),
    }


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    db: SASession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="新密码至少需要 8 位")
    if not verify_password(body.current_password, current_user.hashed_password):
        log_action(
            db,
            action="change_password",
            target_id=str(current_user.id),
            operator_id=current_user.id,
            detail="修改密码失败：当前密码不正确",
            result="failed",
            module="auth",
            request=request,
        )
        raise HTTPException(status_code=400, detail="当前密码不正确")
    if verify_password(body.new_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="新密码不能与当前密码相同")

    current_user.hashed_password = hash_password(body.new_password)
    db.query(SessionModel).filter(
        SessionModel.user_id == current_user.id,
        SessionModel.is_valid == True,
    ).update({SessionModel.is_valid: False})
    db.commit()
    log_action(
        db,
        action="change_password",
        target_id=str(current_user.id),
        operator_id=current_user.id,
        detail="用户修改密码",
        module="auth",
        request=request,
    )
    return {"success": True, "message": "密码已修改，请重新登录"}
