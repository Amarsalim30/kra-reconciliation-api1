from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.models.sap_field_mapping import VatModule, InternalField, SourceType, TransformationType


class SAPFieldMappingResponse(BaseModel):
    id: Optional[int] = None
    module: VatModule
    internal_field: InternalField
    source_type: SourceType
    priority: int
    sap_field: str
    transformation: TransformationType
    transformation_value: Optional[str] = None
    validation_regex: Optional[str] = None
    description: Optional[str] = None
    is_enabled: bool = True

    class Config:
        from_attributes = True


class SAPFieldMappingSavePayload(BaseModel):
    mappings: List[SAPFieldMappingResponse]
    reason: Optional[str] = None
    settings_version: int = Field(..., description="Current system settings version for optimistic locking")



class SAPFieldMappingPreviewPayload(BaseModel):
    sample_document: Dict[str, Any]
    mappings: Optional[List[SAPFieldMappingResponse]] = None


class DiagnosticItem(BaseModel):
    priority: int
    sap_field: str
    status: str  # "found" | "empty" | "failed_validation" | "disabled"
    raw_value: Optional[str] = None
    transformed_value: Optional[str] = None


class PreviewResultItem(BaseModel):
    value: Optional[str] = None
    diagnostics: List[DiagnosticItem] = []
    warnings: List[str] = []
    errors: List[str] = []


class PreviewResponse(BaseModel):
    mapped_values: Dict[InternalField, PreviewResultItem]
