from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from app.core.database import Base


class TaxpayerInfo(Base):
    __tablename__ = "taxpayer_infos"

    id = Column(Integer, primary_key=True, index=True)
    taxpayer_id = Column(String(64), index=True, nullable=False)
    company_name = Column(String(255), index=True, nullable=False)
    legal_person = Column(String(100), default="")
    taxpayer_type = Column(String(100), default="")
    registration_status = Column(String(100), default="")
    industry = Column(String(200), index=True, default="")
    industry_tag = Column(String(120), index=True, default="")
    region = Column(String(200), index=True, default="")
    tax_bureau = Column(String(200), default="")
    manager_department = Column(String(200), index=True, default="")
    tax_officer = Column(String(100), index=True, default="")
    credit_rating = Column(String(50), default="")
    risk_level = Column(String(50), index=True, default="")
    address = Column(String(500), default="")
    address_tag = Column(String(120), index=True, default="")
    phone = Column(String(100), default="")
    business_scope = Column(Text, default="")
    last_used_at = Column(DateTime, nullable=True, index=True)
    source_batch = Column(String(80), index=True, default="")
    raw_json = Column(Text, default="{}")
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
