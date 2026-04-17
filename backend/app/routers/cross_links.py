from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import User
from app.models.cross_link import CrossLinkLog
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/cross-links", tags=["跨模块联动"])


@router.get("")
def list_links(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    links = db.query(CrossLinkLog).filter(
        CrossLinkLog.operator_id == current_user.id,
    ).order_by(CrossLinkLog.created_at.desc()).limit(50).all()
    return {
        "links": [
            {
                "source_module": l.source_module,
                "source_type": l.source_type,
                "source_id": l.source_id,
                "target_module": l.target_module,
                "target_type": l.target_type,
                "target_id": l.target_id,
                "created_at": l.created_at.isoformat(),
            }
            for l in links
        ]
    }
