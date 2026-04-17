from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models.module import Module
from app.routers.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/api/modules", tags=["模块"])


class ModuleSchema(BaseModel):
    id: int
    key: str
    name: str
    description: str
    type: str
    priority: str
    status: str
    icon: str
    is_active: bool

    class Config:
        from_attributes = True


class ModuleListResponse(BaseModel):
    modules: List[ModuleSchema]


@router.get("", response_model=ModuleListResponse)
def list_modules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取所有已注册模块（需要登录）"""
    modules = db.query(Module).filter(Module.is_active == True).all()
    return ModuleListResponse(modules=modules)
