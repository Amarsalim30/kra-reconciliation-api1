from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    JSON,
)
from sqlalchemy.orm import relationship

from app.database.base import Base


class VatRateCategory(str, Enum):
    VAT_16 = "VAT_16"
    VAT_8 = "VAT_8"
    ZERO_RATED = "ZERO_RATED"
    EXEMPT = "EXEMPT"


class BaseAmountPolicy(str, Enum):
    SKIP = "skip"
    REJECT_SESSION = "reject_session"
    TREAT_AS_ZERO = "treat_as_zero"


class UnmappedVatPolicy(str, Enum):
    REJECT_INVOICE = "reject_invoice"
    NEEDS_REVIEW = "needs_review"


class VatModule(str, Enum):
    SALES = "sales"
    PURCHASES = "purchases"


class SAPConnection(Base):
    __tablename__ = "sap_connections"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name = Column(String(100), nullable=False, default="Primary SAP Connection")
    base_url = Column(String(500), nullable=False)
    company_db = Column(String(100), nullable=False)
    username = Column(String(100), nullable=False)
    password = Column(String(500), nullable=False)
    verify_ssl = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    updated_by_id = Column(Integer, nullable=True)

    vat_mappings = relationship("VATMapping", back_populates="connection", cascade="all, delete-orphan")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    active_connection_id = Column(Integer, ForeignKey("sap_connections.id", ondelete="SET NULL"), nullable=True)

    amount_tolerance = Column(Numeric(10, 2), nullable=False, default=10.00)
    base_amount_policy = Column(
        SQLEnum(BaseAmountPolicy, native_enum=False, length=50),
        nullable=False,
        default=BaseAmountPolicy.SKIP,
    )
    unmapped_vat_policy = Column(
        SQLEnum(UnmappedVatPolicy, native_enum=False, length=50),
        nullable=False,
        default=UnmappedVatPolicy.NEEDS_REVIEW,
    )

    ignore_missing_cu = Column(Boolean, nullable=False, default=False)
    include_credit_notes = Column(Boolean, nullable=False, default=True)
    include_debit_notes = Column(Boolean, nullable=False, default=True)
    skip_cancelled = Column(Boolean, nullable=False, default=True)

    version = Column(Integer, nullable=False, default=1)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    updated_by_id = Column(Integer, nullable=True)

    active_connection = relationship("SAPConnection", foreign_keys=[active_connection_id])


class VATMapping(Base):
    __tablename__ = "vat_mappings"
    __table_args__ = (
        UniqueConstraint("connection_id", "module", "sap_code", name="uq_connection_module_sap_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    connection_id = Column(Integer, ForeignKey("sap_connections.id", ondelete="CASCADE"), nullable=False)
    module = Column(SQLEnum(VatModule, native_enum=False, length=20), nullable=False)
    sap_code = Column(String(50), nullable=False)
    description = Column(String(200), nullable=False, default="")
    canonical_value = Column(SQLEnum(VatRateCategory, native_enum=False, length=50), nullable=False)
    is_builtin = Column(Boolean, nullable=False, default=False)
    is_system_generated = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    connection = relationship("SAPConnection", back_populates="vat_mappings")


class SettingAuditLog(Base):
    __tablename__ = "setting_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    user_email = Column(String(255), nullable=True)
    action = Column(String(100), nullable=False)
    changes_json = Column(JSON, nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
