from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.models.settings import (
    BaseAmountPolicy,
    PurchaseCUField,
    UnmappedVatPolicy,
    VatModule,
    VatRateCategory,
)


class SAPConnectionBase(BaseModel):
    name: str = Field(default="Primary SAP Connection", max_length=100)
    base_url: str = Field(..., description="Base URL of SAP Service Layer (e.g. https://sap.example.com:50000/b1s/v1)")
    company_db: str = Field(..., max_length=100)
    username: str = Field(..., max_length=100)
    verify_ssl: bool = Field(default=True)

    @field_validator("base_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip().rstrip("/")
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class SAPConnectionCreate(SAPConnectionBase):
    password: str = Field(..., min_length=1)


class SAPConnectionUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    company_db: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    verify_ssl: Optional[bool] = None
    version: int = Field(..., description="Current connection version for optimistic locking")


class SAPConnectionResponse(SAPConnectionBase):
    id: int
    password_set: bool = True
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SystemSettingsBase(BaseModel):
    amount_tolerance: Decimal = Field(default=Decimal("10.00"), ge=Decimal("0.00"), description="Amount tolerance in KES")
    base_amount_policy: BaseAmountPolicy = Field(default=BaseAmountPolicy.SKIP)
    unmapped_vat_policy: UnmappedVatPolicy = Field(default=UnmappedVatPolicy.NEEDS_REVIEW)
    ignore_missing_cu: bool = Field(default=False)
    include_credit_notes: bool = Field(default=True)
    include_debit_notes: bool = Field(default=True)
    skip_cancelled: bool = Field(default=True)
    purchase_cu_source: PurchaseCUField = Field(default=PurchaseCUField.KRA)


class SystemSettingsUpdate(SystemSettingsBase):
    version: int = Field(..., description="Current system settings version for optimistic locking")
    reason: Optional[str] = Field(None, description="Reason for updating operational settings")


class SystemSettingsResponse(SystemSettingsBase):
    id: int
    active_connection_id: Optional[int] = None
    version: int
    updated_at: datetime
    warning: Optional[str] = None

    class Config:
        from_attributes = True


class VATMappingItem(BaseModel):
    id: Optional[int] = None
    module: VatModule
    sap_code: str = Field(..., min_length=1, max_length=50)
    description: str = Field(default="", max_length=200)
    canonical_value: VatRateCategory
    is_builtin: bool = False
    is_system_generated: bool = False

    class Config:
        from_attributes = True


class VATMappingsUpdatePayload(BaseModel):
    connection_id: Optional[int] = None
    mappings: List[VATMappingItem]
    reason: Optional[str] = None


class SettingsCompositeResponse(BaseModel):
    sap_connection: Optional[SAPConnectionResponse] = None
    system_settings: SystemSettingsResponse
    vat_mappings: List[VATMappingItem]
    is_using_env_fallback: bool = False


class TestConnectionRequest(BaseModel):
    base_url: Optional[str] = None
    company_db: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    verify_ssl: Optional[bool] = None
    connection_id: Optional[int] = None


class StepResult(BaseModel):
    status: str  # "pass" | "fail"
    message: str


class TestConnectionResponse(BaseModel):
    connected: bool
    steps: Dict[str, StepResult]
    metadata: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class SettingAuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    user_email: Optional[str]
    action: str
    changes_json: Dict[str, Any]
    reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
