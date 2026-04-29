from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import SystemSetting, User
from app.routers.auth import get_current_user, require_permission

router = APIRouter(prefix="/api/platform/settings", tags=["系统管理"])

DOCUMENT_SETTING_KEY = "document_defaults"

DEFAULT_DOCUMENT_SETTINGS = {
    "agency_name": "",
    "contact_person": "",
    "contact_phone": "",
    "rectification_deadline": "收到通知后 5 个工作日内",
}


class DocumentSettings(BaseModel):
    agency_name: str = ""
    contact_person: str = ""
    contact_phone: str = ""
    rectification_deadline: str = "收到通知后 5 个工作日内"


def get_document_settings(db: Session, owner_id: int) -> dict[str, Any]:
    setting = db.query(SystemSetting).filter(
        SystemSetting.owner_id == owner_id,
        SystemSetting.key == DOCUMENT_SETTING_KEY,
    ).first()
    value = setting.value if setting and isinstance(setting.value, dict) else {}
    return {**DEFAULT_DOCUMENT_SETTINGS, **value}


@router.get("/document-defaults", response_model=DocumentSettings)
def read_document_defaults(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return DocumentSettings(**get_document_settings(db, current_user.id))


@router.put("/document-defaults", response_model=DocumentSettings)
def update_document_defaults(
    body: DocumentSettings,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("platform:settings:manage")),
):
    setting = db.query(SystemSetting).filter(
        SystemSetting.owner_id == current_user.id,
        SystemSetting.key == DOCUMENT_SETTING_KEY,
    ).first()
    value = body.model_dump()
    if setting:
        setting.value = value
    else:
        setting = SystemSetting(owner_id=current_user.id, key=DOCUMENT_SETTING_KEY, value=value)
        db.add(setting)
    db.commit()
    return DocumentSettings(**value)
