from datetime import date
import logging
from app.schemas.invoice import Invoice, InvoiceSource, ReconciliationType
from app.core.sap_client import SAPClient
from app.services.sap_mapper import map_sap_invoice_to_normalized_records
from app.services.normalization import normalize_invoice_data

logger = logging.getLogger(__name__)


def get_invoices(
    from_date: date,
    to_date: date,
    reconciliation_type: ReconciliationType = ReconciliationType.SALES,
    sap_client: SAPClient = None,
    reconciliation_session_id: str = "N/A"
) -> list[Invoice]:
    """
    Fetches Invoices (Sales or Purchases) page-by-page from SAP Service Layer, maps, normalizes,
    and returns a flattened list of Invoice objects.
    """
    if sap_client is None:
        sap_client = SAPClient()

    logger.info(f"[ReconciliationSession: {reconciliation_session_id}] Login to SAP Service Layer...")

    invoices = []

    # Process page-by-page to keep memory footprint low
    raw_pages = sap_client.get_invoices_pages(
        from_date.isoformat(),
        to_date.isoformat(),
        reconciliation_type=reconciliation_type,
        reconciliation_session_id=reconciliation_session_id
    )

    total_raw_invoices = 0
    total_flattened_lines = 0

    from app.core.config import get_settings, BaseAmountPolicy
    settings = get_settings()
    allow_negative = (settings.sap_base_amount_policy == BaseAmountPolicy.ALLOW)

    for raw_page in raw_pages:
        total_raw_invoices += len(raw_page)
        for raw_inv in raw_page:
            try:
                # 1. Map/Flatten raw SAP invoice to canonical NormalizedSalesRecord dict structures
                mapped_records = map_sap_invoice_to_normalized_records(
                    raw_inv,
                    reconciliation_type=reconciliation_type.value,
                    reconciliation_session_id=reconciliation_session_id
                )

                # 2. Normalize and construct Invoice objects
                for record in mapped_records:
                    try:
                        normalized = normalize_invoice_data(
                            pin=record["pin"],
                            partner_name=record["partner_name"],
                            invoice_number=record["invoice_number"],
                            invoice_date=record["invoice_date"],
                            cu_number=record["cu_number"],
                            vat_group=record["vat_group"],
                            base_amount=record["base_amount"],
                            allow_negative=allow_negative
                        )
                        # Build internal schema
                        invoice = Invoice(**normalized, source=InvoiceSource.SAP)

                        # Double-safeguard date filtering
                        if from_date <= invoice.invoice_date <= to_date:
                            invoices.append(invoice)
                            total_flattened_lines += 1
                    except ValueError as ve:
                        logger.error(
                            f"[ReconciliationSession: {reconciliation_session_id}] Normalization failed for SAP record from invoice {record.get('invoice_number')}: {ve}"
                        )
                        raise
            except Exception as e:
                logger.error(
                    f"[ReconciliationSession: {reconciliation_session_id}] Error processing SAP invoice: {e}"
                )
                raise

    logger.info(f"[ReconciliationSession: {reconciliation_session_id}] Fetched {total_raw_invoices} invoices from SAP")
    logger.info(f"[ReconciliationSession: {reconciliation_session_id}] Flattened into {total_flattened_lines} reconciliation rows")
    logger.info(f"[ReconciliationSession: {reconciliation_session_id}] Returned {len(invoices)} normalized records to caller")

    return invoices
