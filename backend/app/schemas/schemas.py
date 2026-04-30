from pydantic import BaseModel
from typing import Optional, Dict, Any


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    message: str
    user: Optional[Dict[str, Any]] = None


class UserInfo(BaseModel):
    id: int
    username: str
    nickname: str
    role: str


class LogoutResponse(BaseModel):
    success: bool
    message: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
