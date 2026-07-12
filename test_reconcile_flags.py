from app.services.reconciliation_service import reconcile_invoices
from app.schemas.invoice import Invoice, InvoiceSource
from decimal import Decimal
from datetime import date

sap_inv = Invoice(
    pin="P123",
    partner_name="Company A",
    invoice_number="INV1",
    invoice_date=date(2023, 1, 1),
    cu_number="CU1",
    vat_group="16",
    base_amount=Decimal("100"),
    source=InvoiceSource.SAP
)

kra_inv = Invoice(
    pin="P456",
    partner_name="Company B",
    invoice_number="INV1",
    invoice_date=date(2023, 1, 1),
    cu_number="CU1",
    vat_group="16",
    base_amount=Decimal("100"),
    source=InvoiceSource.KRA
)

summary, results = reconcile_invoices([sap_inv], [kra_inv])
print("Partner name matches:", results[0].partner_name_matches)
print("PIN matches:", results[0].pin_matches)
