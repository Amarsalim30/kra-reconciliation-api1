import datetime
import logging
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional

from app.core.config import get_settings, BaseAmountPolicy
from app.core.exceptions import SAPQueryError
from app.services.vat_normalizer import vat_normalizer
from app.domain.document_types import CanonicalReconciliationRow, IngestionProvenance
from app.models.sap_field_mapping import (
    SAPFieldMapping,
    VatModule,
    InternalField,
    SourceType,
    TransformationType,
)
from app.services.sap_field_extractor import extract_and_validate_field

logger = logging.getLogger(__name__)


# Standard default mapping rows used when database settings are unavailable
DEFAULT_SAP_FIELD_MAPPINGS = [
    # Sales
    SAPFieldMapping(
        module=VatModule.SALES,
        internal_field=InternalField.INVOICE_NUMBER,
        source_type=SourceType.HEADER,
        priority=1,
        sap_field="DocNum",
        transformation=TransformationType.NONE,
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.SALES,
        internal_field=InternalField.PARTNER_NAME,
        source_type=SourceType.HEADER,
        priority=1,
        sap_field="CardName",
        transformation=TransformationType.NONE,
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.SALES,
        internal_field=InternalField.INVOICE_DATE,
        source_type=SourceType.HEADER,
        priority=1,
        sap_field="DocDate",
        transformation=TransformationType.NONE,
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.SALES,
        internal_field=InternalField.PIN,
        source_type=SourceType.HEADER,
        priority=1,
        sap_field="FederalTaxID",
        transformation=TransformationType.NONE,
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.SALES,
        internal_field=InternalField.CU_NUMBER,
        source_type=SourceType.HEADER,
        priority=1,
        sap_field="U_CUINV",
        transformation=TransformationType.NONE,
        validation_regex="^(KRA[A-Z0-9]{11,17}/\\d+|\\d{15,25})$",
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.SALES,
        internal_field=InternalField.CU_NUMBER,
        source_type=SourceType.HEADER,
        priority=2,
        sap_field="NumAtCard",
        transformation=TransformationType.NONE,
        validation_regex="^(KRA[A-Z0-9]{11,17}/\\d+|\\d{15,25})$",
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.SALES,
        internal_field=InternalField.BASE_AMOUNT,
        source_type=SourceType.LINE,
        priority=1,
        sap_field="LineTotal",
        transformation=TransformationType.NONE,
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.SALES,
        internal_field=InternalField.VAT_GROUP,
        source_type=SourceType.LINE,
        priority=1,
        sap_field="VatGroup",
        transformation=TransformationType.NONE,
        is_enabled=True,
    ),
    # Purchases
    SAPFieldMapping(
        module=VatModule.PURCHASES,
        internal_field=InternalField.INVOICE_NUMBER,
        source_type=SourceType.HEADER,
        priority=1,
        sap_field="DocNum",
        transformation=TransformationType.NONE,
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.PURCHASES,
        internal_field=InternalField.PARTNER_NAME,
        source_type=SourceType.HEADER,
        priority=1,
        sap_field="CardName",
        transformation=TransformationType.NONE,
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.PURCHASES,
        internal_field=InternalField.INVOICE_DATE,
        source_type=SourceType.HEADER,
        priority=1,
        sap_field="DocDate",
        transformation=TransformationType.NONE,
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.PURCHASES,
        internal_field=InternalField.PIN,
        source_type=SourceType.HEADER,
        priority=1,
        sap_field="FederalTaxID",
        transformation=TransformationType.NONE,
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.PURCHASES,
        internal_field=InternalField.CU_NUMBER,
        source_type=SourceType.HEADER,
        priority=1,
        sap_field="NumAtCard",
        transformation=TransformationType.NONE,
        validation_regex="^(KRA[A-Z0-9]{11,17}/\\d+|\\d{15,25})$",
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.PURCHASES,
        internal_field=InternalField.CU_NUMBER,
        source_type=SourceType.HEADER,
        priority=2,
        sap_field="U_CUINV",
        transformation=TransformationType.NONE,
        validation_regex="^(KRA[A-Z0-9]{11,17}/\\d+|\\d{15,25})$",
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.PURCHASES,
        internal_field=InternalField.CU_SERIAL,
        source_type=SourceType.HEADER,
        priority=1,
        sap_field="U_CUSerial",
        transformation=TransformationType.NONE,
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.PURCHASES,
        internal_field=InternalField.BASE_AMOUNT,
        source_type=SourceType.LINE,
        priority=1,
        sap_field="LineTotal",
        transformation=TransformationType.NONE,
        is_enabled=True,
    ),
    SAPFieldMapping(
        module=VatModule.PURCHASES,
        internal_field=InternalField.VAT_GROUP,
        source_type=SourceType.LINE,
        priority=1,
        sap_field="VatGroup",
        transformation=TransformationType.NONE,
        is_enabled=True,
    ),
]


def parse_sap_date(date_val: Any) -> datetime.date:
    """
    Parses various date formats from SAP Service Layer into a python date object.
    """
    if isinstance(date_val, datetime.date):
        return date_val
    if isinstance(date_val, datetime.datetime):
        return date_val.date()

    date_str = str(date_val).strip()
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue

    try:
        return datetime.date.fromisoformat(date_str[:10])
    except ValueError:
        raise ValueError(f"Invalid SAP DocDate format: '{date_val}'")


def map_sap_document_to_canonical_rows(
    raw_document: Dict[str, Any],
    source_document_type: str,
    endpoint_name: str,
    reconciliation_type: str = "sales",
    reconciliation_session_id: str = "N/A",
    sap_field_mappings: Optional[List[SAPFieldMapping]] = None
) -> List[CanonicalReconciliationRow]:
    """
    Flattens a raw SAP document and maps it to a list of CanonicalReconciliationRow objects.
    Uses configurable mappings for field extraction, transformations, and regex validation.
    """
    settings = get_settings()
    policy = settings.sap_base_amount_policy

    # Fall back to default mappings if none provided
    if not sap_field_mappings:
        sap_field_mappings = DEFAULT_SAP_FIELD_MAPPINGS

    module_name = VatModule.SALES if reconciliation_type == "sales" else VatModule.PURCHASES

    # 1. Extract Invoice Number
    inv_num_result = extract_and_validate_field(
        raw_document, None, InternalField.INVOICE_NUMBER, sap_field_mappings,
        reconciliation_session_id, source_document_type, "unknown"
    )
    if not inv_num_result.value:
        raise SAPQueryError(f"SAP {source_document_type} is missing required field: DocNum")
    invoice_number = inv_num_result.value

    # 2. Extract Partner Name
    partner_name_result = extract_and_validate_field(
        raw_document, None, InternalField.PARTNER_NAME, sap_field_mappings,
        reconciliation_session_id, source_document_type, invoice_number
    )
    partner_name = partner_name_result.value or ""

    # 3. Extract Invoice Date
    date_result = extract_and_validate_field(
        raw_document, None, InternalField.INVOICE_DATE, sap_field_mappings,
        reconciliation_session_id, source_document_type, invoice_number
    )
    if not date_result.value:
        raise SAPQueryError(f"SAP {source_document_type} {invoice_number} is missing required field: DocDate")

    try:
        invoice_date = parse_sap_date(date_result.value)
    except ValueError as exc:
        raise SAPQueryError(f"SAP {source_document_type} {invoice_number} has invalid DocDate: {exc}")

    # 4. Extract PIN
    pin_result = extract_and_validate_field(
        raw_document, None, InternalField.PIN, sap_field_mappings,
        reconciliation_session_id, source_document_type, invoice_number
    )
    pin = pin_result.value or ""
    if not pin:
        logger.warning(
            f"[ReconciliationSession: {reconciliation_session_id}] {source_document_type} {invoice_number} has missing FederalTaxID; using empty string."
        )

    # 5. Extract CU Number
    cu_result = extract_and_validate_field(
        raw_document, None, InternalField.CU_NUMBER, sap_field_mappings,
        reconciliation_session_id, source_document_type, invoice_number
    )
    cu_number = cu_result.value or ""

    # 6. Extract CU Serial (Purchases only)
    cu_serial = ""
    if module_name == VatModule.PURCHASES:
        cu_serial_result = extract_and_validate_field(
            raw_document, None, InternalField.CU_SERIAL, sap_field_mappings,
            reconciliation_session_id, source_document_type, invoice_number
        )
        cu_serial = cu_serial_result.value or ""

    document_lines = raw_document.get("DocumentLines", [])
    if not document_lines:
        logger.warning(
            f"[ReconciliationSession: {reconciliation_session_id}] {source_document_type} {invoice_number} has no DocumentLines."
        )
        return []

    # Determine exact document type
    actual_document_type = source_document_type
    subtype = raw_document.get("DocumentSubType")
    if source_document_type == "Invoice" and subtype == "bod_DebitMemo":
        actual_document_type = "DebitNote"

    valid_lines = []
    for line_idx, line in enumerate(document_lines):
        # Extract VAT Group
        vat_result = extract_and_validate_field(
            raw_document, line, InternalField.VAT_GROUP, sap_field_mappings,
            reconciliation_session_id, source_document_type, invoice_number
        )
        if not vat_result.value:
            raise SAPQueryError(
                f"SAP {source_document_type} {invoice_number} line {line_idx} is missing required field: VatGroup"
            )
        vat_group_str = vat_result.value

        # Normalize SAP VAT code
        vat_group_str = vat_normalizer.normalize("sap", reconciliation_type, vat_group_str)

        # Extract Base Amount
        amount_result = extract_and_validate_field(
            raw_document, line, InternalField.BASE_AMOUNT, sap_field_mappings,
            reconciliation_session_id, source_document_type, invoice_number
        )
        if not amount_result.value:
            raise SAPQueryError(
                f"SAP {source_document_type} {invoice_number} line {line_idx} is missing required field: LineTotal"
            )

        try:
            base_amount = Decimal(amount_result.value)
        except (InvalidOperation, ValueError, TypeError) as exc:
            raise SAPQueryError(
                f"SAP {source_document_type} {invoice_number} line {line_idx} has invalid LineTotal: {exc}"
            )

        # Base Amount Policy Check
        if base_amount <= 0:
            if policy == BaseAmountPolicy.SKIP:
                logger.warning(
                    f"[ReconciliationSession: {reconciliation_session_id}] {source_document_type} {invoice_number} line {line_idx} skipped because base_amount ({base_amount}) <= 0 under policy 'skip'."
                )
                continue
            elif policy == BaseAmountPolicy.REJECT:
                logger.error(
                    f"[ReconciliationSession: {reconciliation_session_id}] {source_document_type} {invoice_number} line {line_idx} rejected because base_amount ({base_amount}) <= 0 under policy 'reject'."
                )
                raise SAPQueryError(
                    f"SAP {source_document_type} {invoice_number} line {line_idx} rejected: Base Amount ({base_amount}) <= 0."
                )

        valid_lines.append((vat_group_str, base_amount))

    # Group by normalized VAT Group and sum LineTotal
    grouped_totals = {}
    for vat_group_str, base_amount in valid_lines:
        grouped_totals[vat_group_str] = grouped_totals.get(vat_group_str, Decimal("0.00")) + base_amount

    # Create canonical reconciliation rows
    canonical_rows = []
    for vat_group_str, total_amount in grouped_totals.items():
        if actual_document_type in ("Invoice", "DebitNote"):
            normalized_amount = abs(total_amount)
        elif actual_document_type == "CreditNote":
            normalized_amount = -abs(total_amount)
        else:
            normalized_amount = abs(total_amount)

        provenance = IngestionProvenance(
            session_source=f"SAP {reconciliation_type.capitalize()}",
            source_endpoint=endpoint_name,
            source_table=None,
            sap_object_type=None,
            source_document_type=actual_document_type,
            doc_entry=raw_document.get("DocEntry"),
            doc_num=invoice_number,
            base_doc_entry=None,
            base_doc_num=None,
            doc_object_code=None,
            raw_amount=total_amount,
            normalized_amount=normalized_amount
        )

        row = CanonicalReconciliationRow(
            pin=pin,
            partner_name=partner_name,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            cu_number=cu_number,
            cu_serial=cu_serial,
            vat_group=vat_group_str,
            base_amount=normalized_amount.quantize(Decimal("0.01")),
            provenance=provenance
        )
        canonical_rows.append(row)

    return canonical_rows
