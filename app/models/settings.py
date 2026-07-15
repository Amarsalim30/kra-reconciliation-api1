from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
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
    last_tested_at = Column(DateTime, nullable=True)
    last_status = Column(String(50), nullable=True, default="UNKNOWN")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    updated_by_id = Column(Integer, nullable=True)

    vat_mappings = relationship("SAPVatMapping", back_populates="connection", cascade="all, delete-orphan")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    active_connection_id = Column(Integer, ForeignKey("sap_connections.id", ondelete="SET NULL"), nullable=True)

    amount_tolerance = Column(Numeric(10, 2), nullable=False, default=10.00)
    date_tolerance = Column(Integer, nullable=False, default=3)
    partner_similarity_threshold = Column(Numeric(3, 2), nullable=False, default=0.85)

    version = Column(Integer, nullable=False, default=1)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    updated_by_id = Column(Integer, nullable=True)

    active_connection = relationship("SAPConnection", foreign_keys=[active_connection_id])


class VATBucket(Base):
    __tablename__ = "vat_buckets"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False, unique=True, index=True)
    display_name = Column(String(100), nullable=False)
    percentage = Column(Numeric(4, 2), nullable=True)
    category = Column(String(50), nullable=False)


class KRASection(Base):
    __tablename__ = "kra_sections"

    id = Column(Integer, primary_key=True, index=True)
    section_code = Column(String(50), nullable=False, unique=True, index=True)
    display_name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    expected_vat_bucket_id = Column(Integer, ForeignKey("vat_buckets.id", ondelete="RESTRICT"), nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)

    expected_vat_bucket = relationship("VATBucket", foreign_keys=[expected_vat_bucket_id])
    allowed_vat_links = relationship("KRASectionAllowedVat", back_populates="section", cascade="all, delete-orphan")


class KRASectionAllowedVat(Base):
    __tablename__ = "kra_section_allowed_vat"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("kra_sections.id", ondelete="CASCADE"), nullable=False)
    vat_bucket_id = Column(Integer, ForeignKey("vat_buckets.id", ondelete="CASCADE"), nullable=False)

    section = relationship("KRASection", back_populates="allowed_vat_links")
    vat_bucket = relationship("VATBucket")


class SAPVatMapping(Base):
    __tablename__ = "sap_vat_mappings"
    __table_args__ = (
        UniqueConstraint("connection_id", "module", "sap_code", name="uq_sap_vat_mapping_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    connection_id = Column(Integer, ForeignKey("sap_connections.id", ondelete="CASCADE"), nullable=False)
    module = Column(String(20), nullable=False)
    sap_code = Column(String(50), nullable=False)
    description = Column(String(200), nullable=False, default="")
    vat_bucket_id = Column(Integer, ForeignKey("vat_buckets.id", ondelete="RESTRICT"), nullable=False)
    is_builtin = Column(Boolean, nullable=False, default=False)

    connection = relationship("SAPConnection", back_populates="vat_mappings")
    vat_bucket = relationship("VATBucket")


class SettingAuditLog(Base):
    __tablename__ = "setting_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    user_email = Column(String(255), nullable=True)
    ip_address = Column(String(50), nullable=True)
    entity = Column(String(50), nullable=True)
    entity_id = Column(String(50), nullable=True)
    field = Column(String(50), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    action = Column(String(100), nullable=False)
    changes_json = Column(JSON, nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
