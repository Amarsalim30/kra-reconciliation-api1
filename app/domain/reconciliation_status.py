from enum import Enum


class ReconciliationStatus(str, Enum):
    """Canonical reconciliation status — lives in the domain layer, not schemas."""
    MATCH               = "Match"
    MISSING_IN_SAP      = "Missing in SAP"
    MISSING_IN_KRA      = "Missing in KRA"
    AMOUNT_MISMATCH     = "Amount Mismatch"
    VAT_MISMATCH        = "VAT Mismatch"
    DATE_MISMATCH       = "Date Mismatch"
    MULTIPLE_MISMATCHES = "Multiple Mismatches"
    DUPLICATE_CU        = "Duplicate CU"
