from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from app.database.base import Base


class VatModule(str, Enum):
    SALES = "sales"
    PURCHASES = "purchases"


class InternalField(str, Enum):
    INVOICE_NUMBER = "invoice_number"
    PARTNER_NAME = "partner_name"
    INVOICE_DATE = "invoice_date"
    PIN = "pin"
    CU_NUMBER = "cu_number"
    CU_SERIAL = "cu_serial"
    BASE_AMOUNT = "base_amount"
    VAT_GROUP = "vat_group"


class SourceType(str, Enum):
    HEADER = "HEADER"
    LINE = "LINE"


class TransformationType(str, Enum):
    NONE = "NONE"
    BEFORE_SLASH = "BEFORE_SLASH"
    AFTER_SLASH = "AFTER_SLASH"
    REGEX = "REGEX"
    REGEX_REPLACE = "REGEX_REPLACE"
    TRIM = "TRIM"
    UPPERCASE = "UPPERCASE"
    LOWERCASE = "LOWERCASE"


class SAPFieldMapping(Base):
    __tablename__ = "sap_field_mappings"
    __table_args__ = (
        UniqueConstraint(
            "module", "internal_field", "priority", name="uq_sap_mapping_module_field_priority"
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    module = Column(SQLEnum(VatModule, native_enum=False, length=20), nullable=False)
    internal_field = Column(SQLEnum(InternalField, native_enum=False, length=50), nullable=False)
    source_type = Column(SQLEnum(SourceType, native_enum=False, length=20), nullable=False)
    priority = Column(Integer, nullable=False)
    sap_field = Column(String(100), nullable=False)
    transformation = Column(SQLEnum(TransformationType, native_enum=False, length=50), nullable=False, default=TransformationType.NONE)
    transformation_value = Column(String(255), nullable=True)
    validation_regex = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    is_enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
