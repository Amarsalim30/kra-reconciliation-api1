from decimal import Decimal
from enum import Enum
from pydantic import BaseModel, Field
from app.schemas.invoice import Invoice

# Re-exported from domain for backward compatibility — import from here or from domain directly
from app.domain.reconciliation_status import ReconciliationStatus  # noqa: F401


class ReconciliationConfig(BaseModel):
    amount_tolerance: Decimal = Field(default=Decimal("10.00"), ge=Decimal("0.00"))
    date_tolerance: int = Field(default=3, ge=0)
    partner_similarity_threshold: float = Field(default=0.85, ge=0.50, le=1.00)


class DifferenceField(str, Enum):
    BASE_AMOUNT = "base_amount"
    VAT_GROUP = "vat_group"
    INVOICE_DATE = "invoice_date"

class Difference(BaseModel):
    field: DifferenceField
    match: bool
    sap_value: str
    kra_value: str

class ReconciliationResult(BaseModel):
    cu_number: str
    sap: Invoice | None = None
    kra: Invoice | None = None
    status: ReconciliationStatus
    amount_match: bool
    vat_match: bool
    date_match: bool
    partner_name_matches: bool = True
    pin_matches: bool = True
    differences: list[Difference]
    sap_source_index: int | None = None
    kra_source_index: int | None = None

class MismatchStats(BaseModel):
    amount: int = 0
    vat: int = 0
    date: int = 0

class ReconciliationSummary(BaseModel):
    total_sap: int
    total_kra: int
    matches: int
    missing_in_sap: int
    missing_in_kra: int
    missing_cu: int = 0
    mismatches: int
    duplicate_cu: int
    match_percentage: float
    completion_percentage: float
    total_reconciled_rows: int = 0
    mismatch_stats: MismatchStats

class ReconciliationCompareRequest(BaseModel):
    session_id: str

class ReconciliationResponse(BaseModel):
    session_id: str
    summary: ReconciliationSummary

class PaginatedReconciliationResultsResponse(BaseModel):
    session_id: str
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[ReconciliationResult]

