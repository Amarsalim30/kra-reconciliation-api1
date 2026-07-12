from app.database.database import SessionLocal
from app.models.reconciliation_session import SessionReconciliationResult, ReconciliationSession
from app.api.v1.reconciliation import compare_session_invoices
from app.schemas.reconciliation import ReconciliationCompareRequest
from app.models.user import User

db = SessionLocal()
res = db.query(SessionReconciliationResult).filter(SessionReconciliationResult.sap_partner_name == "Gulf Power").first()
if res:
    session_id = res.session_id
    session = db.query(ReconciliationSession).filter(ReconciliationSession.id == session_id).first()
    
    print("Found session:", session_id)
    # We will simulate re-comparing this session.
    # We need to manually call the logic to see what it does.
    
    # First let's check what the backend logic actually returns for this session's invoices
    from app.services.reconciliation_service import reconcile_invoices
    from app.schemas.invoice import Invoice, InvoiceSource
    
    sap_invoices = [
        Invoice(
            pin=i.pin, partner_name=i.partner_name, invoice_number=i.invoice_number,
            invoice_date=i.invoice_date, cu_number=i.cu_number, vat_group=i.vat_group,
            base_amount=i.base_amount, source=InvoiceSource(i.source)
        ) for i in session.invoices if i.source == InvoiceSource.SAP
    ]
    kra_invoices = [
        Invoice(
            pin=i.pin, partner_name=i.partner_name, invoice_number=i.invoice_number,
            invoice_date=i.invoice_date, cu_number=i.cu_number, vat_group=i.vat_group,
            base_amount=i.base_amount, source=InvoiceSource(i.source)
        ) for i in session.invoices if i.source == InvoiceSource.KRA
    ]
    
    summary, results = reconcile_invoices(sap_invoices, kra_invoices)
    
    for r in results:
        if r.sap and r.sap.partner_name == "Gulf Power":
            print(f"Algorithm Output -> partner_name_matches: {r.partner_name_matches}, pin_matches: {r.pin_matches}")
            break
