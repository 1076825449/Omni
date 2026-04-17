from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models.module import Module
from app.routers.auth import get_current_user, require_permission
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


class ModuleRegisterRequest(BaseModel):
    key: str
    name: str
    description: str = ""
    type: str = "custom"        # workflow / list / interactive / custom
    priority: str = "medium"     # high / medium / low
    status: str = "active"       # active / developing / offline
    icon: str = "appstore"


class ModuleConfigSchema(BaseModel):
    key: str
    name: str
    description: str
    type: str
    priority: str
    status: str
    icon: str
    is_active: bool
    config: dict = {}


class ModuleUpdateConfigRequest(BaseModel):
    config: dict


@router.get("", response_model=ModuleListResponse)
def list_modules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取所有已注册模块（需要登录）"""
    modules = db.query(Module).filter(Module.is_active == True).all()
    return ModuleListResponse(modules=modules)


@router.get("/all")
def list_all_modules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取所有模块（含禁用的，需要 admin）"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可查看")
    modules = db.query(Module).order_by(Module.id.desc()).all()
    return {"modules": modules}


@router.post("/register", response_model=ModuleSchema)
def register_module(
    body: ModuleRegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """注册新模块（需要 admin 权限）"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可注册模块")

    existing = db.query(Module).filter(Module.module_id == body.key).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"模块 {body.key} 已存在")

    module = Module(
        module_id=body.key,
        name=body.name,
        description=body.description,
        type=body.type,
        priority=body.priority,
        status=body.status,
        icon=body.icon,
        is_active=True,
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    return ModuleSchema(
        id=module.id,
        key=module.module_id,
        name=module.name,
        description=module.description,
        type=module.type,
        priority=module.priority,
        status=module.status,
        icon=module.icon,
        is_active=module.is_active,
    )


@router.get("/{module_key}/config")
def get_module_config(
    module_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取指定模块的配置"""
    m = db.query(Module).filter(Module.module_id == module_key).first()
    if not m:
        raise HTTPException(status_code=404, detail="模块不存在")
    return {
        "key": m.module_id,
        "name": m.name,
        "description": m.description,
        "type": m.type,
        "priority": m.priority,
        "status": m.status,
        "icon": m.icon,
        "is_active": m.is_active,
        "config": {},  # 未来可扩展为独立的 module_config 表
    }


@router.put("/{module_key}/config")
def update_module_config(
    module_key: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新模块配置（需要 admin 权限）"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可更新模块配置")

    m = db.query(Module).filter(Module.module_id == module_key).first()
    if not m:
        raise HTTPException(status_code=404, detail="模块不存在")

    # 可更新的字段
    for field in ("name", "description", "status", "icon", "is_active"):
        if field in body:
            setattr(m, field, body[field])

    db.commit()
    return {"success": True, "message": f"模块 {module_key} 配置已更新"}
