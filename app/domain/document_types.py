from dataclasses import dataclass
from decimal import Decimal
from datetime import date
from typing import Optional

@dataclass(frozen=True)
class IngestionProvenance:
    session_source: Optional[str]           # e.g., "SAP Sales" / "SAP Purchases"
    source_endpoint: Optional[str]          # e.g., "Invoices", "CreditNotes"
    source_table: Optional[str]             # e.g., "OINV", "ORIN"
    sap_object_type: Optional[str]          # e.g., "13", "14"
    source_document_type: str               # e.g., "Invoice", "CreditNote", "DebitNote"
    doc_entry: Optional[int]
    doc_num: Optional[str]
    base_doc_entry: Optional[int]
    base_doc_num: Optional[str]
    doc_object_code: Optional[str]          # Raw SAP DocObjectCode
    raw_amount: Decimal                     # Original aggregated base amount before mapping
    normalized_amount: Decimal              # Final normalized amount

@dataclass(frozen=True)
class CanonicalReconciliationRow:
    cu_number: str                       # Composite match key part
    vat_group: str                       # Composite match key part
    base_amount: Decimal                 # Signed taxable base amount used for reconciliation
    invoice_number: str                  # Informational metadata
    invoice_date: date                   # Informational metadata
    pin: str                             # Informational metadata
    partner_name: str                    # Informational metadata
    provenance: IngestionProvenance      # Audit metadata (in-memory)
    cu_serial: Optional[str] = ""        # Informational metadata


    def __post_init__(self):
        # Enforce mandatory fields
        if not self.vat_group:
            raise ValueError("VAT Group is a mandatory field for CanonicalReconciliationRow")
        if self.base_amount is None:
            raise ValueError("Base Amount is a mandatory field for CanonicalReconciliationRow")
        if not self.invoice_date:
            raise ValueError("Invoice Date is a mandatory field for CanonicalReconciliationRow")
