from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Response, Cookie, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import SESSION_COOKIE_NAME, SESSION_EXPIRE_SECONDS
from app.models import User, Session as SessionModel
from app.schemas.schemas import LoginRequest, LoginResponse, LogoutResponse, UserInfo
from app.services.auth import (
    hash_password, verify_password,
    create_session_id, make_expires_at,
)

router = APIRouter(prefix="/api/auth", tags=["认证"])


def get_current_user(
    request: Request,
    response: Response,
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """验证会话，返回当前用户或 None"""
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


@router.post("/login", response_model=LoginResponse)
def login(
    body: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        return LoginResponse(success=False, message="用户名或密码错误")
    if not user.is_active:
        return LoginResponse(success=False, message="账号已被禁用")

    sid = create_session_id()
    session = SessionModel(
        session_id=sid,
        user_id=user.id,
        expires_at=make_expires_at(),
    )
    db.add(session)
    db.commit()

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=sid,
        httponly=True,
        samesite="lax",
        max_age=SESSION_EXPIRE_SECONDS,
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
    session_id: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    if session_id:
        session = db.query(SessionModel).filter(SessionModel.session_id == session_id).first()
        if session:
            session.is_valid = False
            db.commit()
    response.delete_cookie(SESSION_COOKIE_NAME)
    return LogoutResponse(success=True, message="已退出登录")


@router.get("/me", response_model=Optional[UserInfo])
def get_me(current_user: Optional[User] = Depends(get_current_user)):
    if not current_user:
        return None
    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        nickname=current_user.nickname,
        role=current_user.role,
    )
