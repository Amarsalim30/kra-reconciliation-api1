from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    reason: Optional[str] = Field(None, description="Reason for updating connection details")


class SAPConnectionResponse(SAPConnectionBase):
    id: int
    password_set: bool = True
    is_active: bool
    version: int
    last_tested_at: Optional[datetime] = None
    last_status: Optional[str] = "UNKNOWN"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SystemSettingsBase(BaseModel):
    amount_tolerance: Decimal = Field(default=Decimal("10.00"), ge=Decimal("0.00"), description="Amount tolerance in KES")
    date_tolerance: int = Field(default=3, ge=0, description="Invoice date tolerance in days")
    partner_similarity_threshold: float = Field(default=0.85, ge=0.50, le=1.00, description="Partner similarity threshold (0.50-1.00)")


class SystemSettingsUpdate(SystemSettingsBase):
    version: int = Field(..., description="Current system settings version for optimistic locking")
    reason: Optional[str] = Field(..., description="Reason for updating operational settings (mandatory)")


class SystemSettingsResponse(SystemSettingsBase):
    id: int
    active_connection_id: Optional[int] = None
    version: int
    updated_at: datetime
    warning: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VATBucketSchema(BaseModel):
    id: int
    code: str
    display_name: str
    percentage: Optional[Decimal] = None
    category: str

    model_config = ConfigDict(from_attributes=True)


class KRASectionSchema(BaseModel):
    id: int
    section_code: str
    display_name: str
    description: Optional[str] = None
    expected_vat_bucket_code: str
    allowed_vat_bucket_codes: List[str]
    enabled: bool = True
    sort_order: int = 0

    model_config = ConfigDict(from_attributes=True)


class SAPVatMappingItem(BaseModel):
    id: Optional[int] = None
    module: str = Field(..., description="purchases or sales")
    sap_code: str = Field(..., min_length=1, max_length=50)
    description: str = Field(default="", max_length=200)
    vat_bucket_code: str = Field(..., description="Target VATBucket code (STANDARD, REDUCED, ZERO, EXEMPT)")
    is_builtin: bool = False

    model_config = ConfigDict(from_attributes=True)


class TaxConfigurationResponse(BaseModel):
    vat_buckets: List[VATBucketSchema]
    kra_sections: List[KRASectionSchema]
    vat_mappings: List[SAPVatMappingItem]
    coverage: Dict[str, int]


class TaxConfigurationUpdatePayload(BaseModel):
    connection_id: Optional[int] = None
    reason: str = Field(..., description="Reason for updating tax code mappings (mandatory)")
    mappings: List[SAPVatMappingItem]


class SettingsCompositeResponse(BaseModel):
    sap_connection: Optional[SAPConnectionResponse] = None
    system_settings: SystemSettingsResponse
    tax_configuration: TaxConfigurationResponse
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
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    ip_address: Optional[str] = None
    entity: Optional[str] = None
    entity_id: Optional[str] = None
    field: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    action: str
    changes_json: Dict[str, Any]
    reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConfigExportPayload(BaseModel):
    schema_version: int = 2
    application: str = "KRA Reconciliation System"
    exported_at: datetime
    settings: Dict[str, Any]


class ImportDiffItem(BaseModel):
    entity: str
    key: str
    old: Optional[str] = None
    new: Optional[str] = None


class ImportValidationSummary(BaseModel):
    valid: bool
    critical_errors: List[str] = []
    warnings: List[str] = []
    diffs: List[ImportDiffItem] = []
