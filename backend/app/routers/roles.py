from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models import User, Role
from app.models.permission import ALL_PERMISSIONS, ROLE_PERMISSIONS
from app.routers.auth import get_current_user, require_permission

router = APIRouter(prefix="/api/platform/roles", tags=["平台公共"])


class RoleSchema(BaseModel):
    id: int
    name: str
    display_name: str
    description: str
    permissions: List[str]
    is_active: bool

    class Config:
        from_attributes = True


class RoleListResponse(BaseModel):
    roles: List[RoleSchema]


class RoleUpdateRequest(BaseModel):
    display_name: str
    description: str
    permissions: List[str]


@router.get("", response_model=RoleListResponse)
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("platform:role:manage")),
):
    roles = db.query(Role).all()
    return RoleListResponse(roles=roles)


@router.get("/permissions")
def list_all_permissions(
    current_user: User = Depends(require_permission("platform:role:manage")),
):
    return {
        "permissions": sorted(ALL_PERMISSIONS),
        "defaults": ROLE_PERMISSIONS,
    }


@router.put("/{role_name}")
def update_role(
    role_name: str,
    body: RoleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("platform:role:manage")),
):
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    role.display_name = body.display_name
    role.description = body.description
    role.permissions = body.permissions
    db.commit()
    return {"success": True, "message": "角色已更新"}
