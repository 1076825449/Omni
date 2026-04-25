from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from app.core.database import Base


class RiskDossier(Base):
    __tablename__ = "risk_dossiers"

    id = Column(Integer, primary_key=True, index=True)
    taxpayer_id = Column(String(64), index=True, nullable=False)
    company_name = Column(String(255), index=True, nullable=False)
    registration_status = Column(String(100), default="")
    tax_officer = Column(String(100), index=True, default="")
    address = Column(String(500), default="")
    is_temporary = Column(Boolean, default=False)
    source = Column(String(80), default="info-query")
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RiskLedgerEntry(Base):
    __tablename__ = "risk_ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(String(64), unique=True, index=True, nullable=False)
    dossier_id = Column(Integer, ForeignKey("risk_dossiers.id"), nullable=False, index=True)
    taxpayer_id = Column(String(64), index=True, nullable=False)
    recorded_at = Column(DateTime, index=True, nullable=False)
    content = Column(Text, nullable=False)
    entry_status = Column(String(20), index=True, default="待核实")
    note = Column(Text, default="")
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
