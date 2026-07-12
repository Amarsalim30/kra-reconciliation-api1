from app.database.database import SessionLocal
from app.models.reconciliation_session import SessionReconciliationResult
from app.schemas.invoice import Invoice, InvoiceSource
from app.services.reconciliation_service import check_partner_name_matches, check_pin_matches

db = SessionLocal()
results = db.query(SessionReconciliationResult).all()

count = 0
for r in results:
    if not r.sap_invoice_number or not r.kra_invoice_number:
        # Missing cases
        name_match = False
        pin_match = True
    else:
        sap_inv = Invoice(
            pin=r.sap_pin or "",
            partner_name=r.sap_partner_name or "",
            invoice_number=r.sap_invoice_number,
            invoice_date=r.sap_invoice_date or "2020-01-01",
            cu_number=r.cu_number,
            vat_group="0",
            base_amount=0,
            source=InvoiceSource.SAP
        )
        kra_inv = Invoice(
            pin=r.kra_pin or "",
            partner_name=r.kra_partner_name or "",
            invoice_number=r.kra_invoice_number,
            invoice_date=r.kra_invoice_date or "2020-01-01",
            cu_number=r.cu_number,
            vat_group="0",
            base_amount=0,
            source=InvoiceSource.KRA
        )
        name_match = check_partner_name_matches(sap_inv, kra_inv)
        pin_match = check_pin_matches(sap_inv, kra_inv)

    if r.partner_name_matches != name_match or r.pin_matches != pin_match:
        r.partner_name_matches = name_match
        r.pin_matches = pin_match
        count += 1

db.commit()
print(f"Updated {count} existing records in the database using fuzzy match.")
