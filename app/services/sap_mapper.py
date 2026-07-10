import datetime
import logging
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List
from app.core.config import get_settings, BaseAmountPolicy
from app.core.exceptions import SAPQueryError

logger = logging.getLogger(__name__)


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


def map_sap_invoice_to_normalized_records(
    raw_invoice: Dict[str, Any], reconciliation_session_id: str = "N/A"
) -> List[Dict[str, Any]]:
    """
    Flattens a raw SAP Invoice and maps it to a list of canonical NormalizedSalesRecord dict structures.
    Applies configurable base amount policies and warns on missing/invalid fields.
    """
    settings = get_settings()
    policy = settings.sap_base_amount_policy

    # Extract header fields
    invoice_number_raw = raw_invoice.get("DocNum")
    if invoice_number_raw is None:
        raise SAPQueryError("SAP invoice is missing required field: DocNum")
    invoice_number = str(invoice_number_raw).strip()

    customer_name = raw_invoice.get("CardName")
    if customer_name is None:
        raise SAPQueryError(f"SAP Invoice {invoice_number} is missing required field: CardName")
    customer_name = str(customer_name).strip()

    doc_date_raw = raw_invoice.get("DocDate")
    if doc_date_raw is None:
        raise SAPQueryError(f"SAP Invoice {invoice_number} is missing required field: DocDate")

    try:
        invoice_date = parse_sap_date(doc_date_raw)
    except ValueError as exc:
        raise SAPQueryError(f"SAP Invoice {invoice_number} has invalid DocDate: {exc}")

    # Fallbacks and warnings for PIN
    raw_pin = raw_invoice.get("FederalTaxID")
    if not raw_pin:
        pin = ""
        logger.warning(
            f"[ReconciliationSession: {reconciliation_session_id}] Invoice {invoice_number} has missing FederalTaxID; using empty string."
        )
    else:
        pin = str(raw_pin).strip()

    # Fallbacks and warnings for CU Number
    raw_cu = raw_invoice.get("U_CUINV")
    if not raw_cu:
        cu_number = ""
        logger.warning(
            f"[ReconciliationSession: {reconciliation_session_id}] Invoice {invoice_number} has missing U_CUINV; using empty string."
        )
    else:
        cu_number = str(raw_cu).strip().lstrip("|").strip()

    document_lines = raw_invoice.get("DocumentLines", [])
    if not document_lines:
        # If there are no lines, check if it's a valid empty document. Normally, Service Layer invoices always have lines.
        logger.warning(
            f"[ReconciliationSession: {reconciliation_session_id}] Invoice {invoice_number} has no DocumentLines."
        )
        return []

    normalized_records = []
    for line_idx, line in enumerate(document_lines):
        # 1. VAT Group
        vat_group = line.get("VatGroup")
        if vat_group is None:
            raise SAPQueryError(
                f"SAP Invoice {invoice_number} line {line_idx} is missing required field: VatGroup"
            )
        vat_group_str = str(vat_group).strip()
        if not vat_group_str:
            raise SAPQueryError(
                f"SAP Invoice {invoice_number} line {line_idx} has empty VatGroup"
            )

        # 2. Base Amount (LineTotal)
        line_total_raw = line.get("LineTotal")
        if line_total_raw is None:
            raise SAPQueryError(
                f"SAP Invoice {invoice_number} line {line_idx} is missing required field: LineTotal"
            )

        try:
            base_amount = Decimal(str(line_total_raw).strip())
        except (InvalidOperation, ValueError, TypeError) as exc:
            raise SAPQueryError(
                f"SAP Invoice {invoice_number} line {line_idx} has invalid LineTotal: {exc}"
            )

        # 3. Base Amount Policy Check
        if base_amount <= 0:
            if policy == BaseAmountPolicy.SKIP:
                logger.warning(
                    f"[ReconciliationSession: {reconciliation_session_id}] Invoice {invoice_number} line {line_idx} skipped because base_amount ({base_amount}) <= 0 under policy 'skip'."
                )
                continue
            elif policy == BaseAmountPolicy.REJECT:
                logger.error(
                    f"[ReconciliationSession: {reconciliation_session_id}] Invoice {invoice_number} line {line_idx} rejected because base_amount ({base_amount}) <= 0 under policy 'reject'."
                )
                raise SAPQueryError(
                    f"SAP Invoice {invoice_number} line {line_idx} rejected: Base Amount ({base_amount}) <= 0."
                )
            # Under ALLOW, we proceed and include the record

        # Add flat record
        normalized_records.append({
            "pin": pin,
            "customer_name": customer_name,
            "invoice_number": invoice_number,
            "invoice_date": invoice_date,
            "cu_number": cu_number,
            "vat_group": vat_group_str,
            "base_amount": base_amount.quantize(Decimal("0.01"))
        })

    return normalized_records
