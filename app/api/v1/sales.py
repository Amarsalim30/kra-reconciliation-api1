from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_active_session
from app.database.database import get_db
from app.models.user import User
from app.models.reconciliation_session import ReconciliationSession, SessionInvoice
from app.schemas.sales import SalesFetchResponse, SalesUploadResponse, InvoiceSource
from app.services import sap_service, kra_service

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("", response_model=SalesFetchResponse)
def get_sales(
    from_date: date = Query(..., alias="from", description="Start date (YYYY-MM-DD)"),
    to_date: date = Query(..., alias="to", description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch sales invoices within a given date range. Currently returns normalized mock SAP data.
    Temporarily stores the loaded invoices in a database-backed session.
    """
    # 1. Global Cleanup: Clear user's expired sessions (> 30 min idle)
    expiry_time = datetime.utcnow() - timedelta(minutes=30)
    db.query(ReconciliationSession).filter(
        ReconciliationSession.user_id == current_user.id,
        ReconciliationSession.last_accessed_at < expiry_time
    ).delete()
    db.commit()

    # 2. Fetch mock SAP data
    invoices = sap_service.get_sales_invoices(from_date, to_date)

    # 3. Create a new ReconciliationSession
    session = ReconciliationSession(
        user_id=current_user.id,
        from_date=from_date,
        to_date=to_date,
        is_compared=False
    )
    db.add(session)
    db.commit()

    # 4. Save loaded SAP invoices relationally
    db_invoices = [
        SessionInvoice(
            session_id=session.id,
            row_number=idx + 1,
            source=inv.source,
            pin=inv.pin,
            customer_name=inv.customer_name,
            invoice_number=inv.invoice_number,
            invoice_date=inv.invoice_date,
            cu_number=inv.cu_number,
            vat_group=inv.vat_group,
            base_amount=inv.base_amount
        )
        for idx, inv in enumerate(invoices)
    ]
    db.add_all(db_invoices)
    db.commit()

    return SalesFetchResponse(
        session_id=session.id,
        source="SAP",
        count=len(invoices),
        from_date=from_date,
        to_date=to_date,
        invoices=invoices[:100]
    )



@router.post("/upload", response_model=SalesUploadResponse)
def upload_sales_csv(
    file: UploadFile,
    session_id: str = Query(..., description="Active reconciliation session ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a KRA CSV file containing sales invoices. Normalizes and appends records to the active session.
    """
    # 1. Validate active session using the dependency logic (checks expiry & user ownership)
    session = get_active_session(session_id=session_id, db=db, current_user=current_user)

    # 2. Parse and normalize KRA CSV
    upload_res = kra_service.parse_kra_csv(file)

    # 3. Save KRA invoices to DB under the session only if there are successfully parsed invoices
    if upload_res.parsed > 0:
        # Clear any previously uploaded KRA invoices for this session (resets state)
        db.query(SessionInvoice).filter(
            SessionInvoice.session_id == session.id,
            SessionInvoice.source == InvoiceSource.KRA
        ).delete()

        db_invoices = [
            SessionInvoice(
                session_id=session.id,
                row_number=idx + 1,
                source=inv.source,
                pin=inv.pin,
                customer_name=inv.customer_name,
                invoice_number=inv.invoice_number,
                invoice_date=inv.invoice_date,
                cu_number=inv.cu_number,
                vat_group=inv.vat_group,
                base_amount=inv.base_amount
            )
            for idx, inv in enumerate(upload_res.invoices)
        ]
        db.add_all(db_invoices)
        db.commit()

    # Make sure session_id is returned
    upload_res.session_id = session.id
    upload_res.invoices = upload_res.invoices[:100]
    return upload_res

