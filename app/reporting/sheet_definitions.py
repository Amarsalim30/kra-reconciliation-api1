from dataclasses import dataclass

from app.domain.reconciliation_status import ReconciliationStatus


@dataclass(frozen=True)
class SheetColumn:
    header: str
    attr: str
    is_amount: bool = False
    is_date: bool = False
    is_bool: bool = False
    is_cu: bool = False
    width: float = 20.0


@dataclass(frozen=True)
class SheetDefinition:
    filename: str
    title: str
    columns: tuple[SheetColumn, ...]
    statuses: frozenset[ReconciliationStatus] | None = None  # None = all rows
    is_compact: bool = False  # compact = no redundant SAP/KRA columns


# Reusable column sets
_CU_COL = SheetColumn(header="CU Number", attr="cu_number", is_cu=True, width=22)
_REMARK_COL = SheetColumn(header="Remark", attr="remark", width=20)

_SAP_PIN = SheetColumn(header="SAP PIN", attr="sap_pin", width=18)
_SAP_PARTNER = SheetColumn(header="SAP Partner", attr="sap_partner_name", width=30)
_SAP_INV_NUM = SheetColumn(header="SAP Invoice #", attr="sap_invoice_number", width=18)
_SAP_DATE = SheetColumn(header="SAP Date", attr="sap_invoice_date", is_date=True, width=14)
_SAP_AMOUNT = SheetColumn(header="SAP Amount", attr="sap_base_amount", is_amount=True, width=18)
_SAP_VAT = SheetColumn(header="SAP VAT", attr="sap_vat_group", width=12)

_KRA_PIN = SheetColumn(header="KRA PIN", attr="kra_pin", width=18)
_KRA_PARTNER = SheetColumn(header="KRA Partner", attr="kra_partner_name", width=30)
_KRA_INV_NUM = SheetColumn(header="KRA Invoice #", attr="kra_invoice_number", width=18)
_KRA_DATE = SheetColumn(header="KRA Date", attr="kra_invoice_date", is_date=True, width=14)
_KRA_AMOUNT = SheetColumn(header="KRA Amount", attr="kra_base_amount", is_amount=True, width=18)
_KRA_VAT = SheetColumn(header="KRA VAT", attr="kra_vat_group", width=12)

_MATCH_AMT = SheetColumn(header="Amount Match", attr="amount_match", is_bool=True, width=14)
_MATCH_VAT = SheetColumn(header="VAT Match", attr="vat_match", is_bool=True, width=12)
_MATCH_DATE = SheetColumn(header="Date Match", attr="date_match", is_bool=True, width=14)

NEEDS_REVIEW_STATUSES = frozenset({
    ReconciliationStatus.DUPLICATE_SOURCE_KEY,
    ReconciliationStatus.MISSING_IN_SAP,
    ReconciliationStatus.MISSING_IN_KRA,
    ReconciliationStatus.AMOUNT_MISMATCH,
    ReconciliationStatus.VAT_MISMATCH,
    ReconciliationStatus.MULTIPLE_MISMATCHES,
})

MATCH_STATUSES = frozenset({ReconciliationStatus.MATCH})

# Sheet definitions — order matters for ZIP layout
SHEET_DEFINITIONS: tuple[SheetDefinition, ...] = (
    SheetDefinition(
        filename="02 Needs Review.xlsx",
        title="Needs Review",
        columns=(
            _CU_COL, _REMARK_COL,
            _SAP_PIN, _SAP_PARTNER, _SAP_INV_NUM, _SAP_DATE, _SAP_AMOUNT, _SAP_VAT,
            _KRA_PIN, _KRA_PARTNER, _KRA_INV_NUM, _KRA_DATE, _KRA_AMOUNT, _KRA_VAT,
            _MATCH_AMT, _MATCH_VAT, _MATCH_DATE,
        ),
        statuses=NEEDS_REVIEW_STATUSES,
    ),
    SheetDefinition(
        filename="04 Matches.xlsx",
        title="Matches",
        columns=(
            _CU_COL, _REMARK_COL,
            _SAP_PIN, _SAP_PARTNER, _SAP_INV_NUM, _SAP_DATE, _SAP_AMOUNT, _SAP_VAT,
            _KRA_INV_NUM, _KRA_DATE, _KRA_AMOUNT, _KRA_VAT,
        ),
        statuses=MATCH_STATUSES,
        is_compact=True,
    ),
    SheetDefinition(
        filename="05 Amount Mismatches.xlsx",
        title="Amount Mismatches",
        columns=(
            _CU_COL, _REMARK_COL,
            _SAP_PIN, _SAP_PARTNER, _SAP_INV_NUM, _SAP_DATE, _SAP_AMOUNT, _SAP_VAT,
            _KRA_PIN, _KRA_PARTNER, _KRA_INV_NUM, _KRA_DATE, _KRA_AMOUNT, _KRA_VAT,
            _MATCH_AMT, _MATCH_VAT, _MATCH_DATE,
        ),
        statuses=frozenset({ReconciliationStatus.AMOUNT_MISMATCH, ReconciliationStatus.MULTIPLE_MISMATCHES}),
    ),
    SheetDefinition(
        filename="06 VAT Mismatches.xlsx",
        title="VAT Mismatches",
        columns=(
            _CU_COL, _REMARK_COL,
            _SAP_PIN, _SAP_PARTNER, _SAP_INV_NUM, _SAP_DATE, _SAP_AMOUNT, _SAP_VAT,
            _KRA_PIN, _KRA_PARTNER, _KRA_INV_NUM, _KRA_DATE, _KRA_AMOUNT, _KRA_VAT,
            _MATCH_AMT, _MATCH_VAT, _MATCH_DATE,
        ),
        statuses=frozenset({ReconciliationStatus.VAT_MISMATCH, ReconciliationStatus.MULTIPLE_MISMATCHES}),
    ),
)
