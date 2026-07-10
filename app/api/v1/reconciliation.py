from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_active_session
from app.database.database import get_db
from app.models.user import User
from app.schemas.sales import SalesInvoice, InvoiceSource
from app.schemas.reconciliation import ReconciliationCompareRequest, ReconciliationResponse
from app.services import reconciliation_service

router = APIRouter(prefix="/reconciliation", tags=["reconciliation"])


@router.post("/compare", response_model=ReconciliationResponse)
def compare_session_invoices(
    body: ReconciliationCompareRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Runs the reconciliation matching engine on the loaded SAP and KRA invoices for the active session.
    Saves the calculated results to the session database, keeping it available for export/review.
    """
    # 1. Validate active session
    session = get_active_session(session_id=body.session_id, db=db, current_user=current_user)

    # 2. Return cached results immediately if comparison has already run
    if session.is_compared and session.comparison_results:
        return ReconciliationResponse(**session.comparison_results)

    # 3. Retrieve session invoices and build SalesInvoice domain lists
    invoices = session.invoices
    
    sap_invoices = [
        SalesInvoice(
            pin=i.pin,
            customer_name=i.customer_name,
            invoice_number=i.invoice_number,
            invoice_date=i.invoice_date,
            cu_number=i.cu_number,
            vat_group=i.vat_group,
            base_amount=i.base_amount,
            source=InvoiceSource(i.source)
        )
        for i in invoices if i.source == InvoiceSource.SAP
    ]
    
    kra_invoices = [
        SalesInvoice(
            pin=i.pin,
            customer_name=i.customer_name,
            invoice_number=i.invoice_number,
            invoice_date=i.invoice_date,
            cu_number=i.cu_number,
            vat_group=i.vat_group,
            base_amount=i.base_amount,
            source=InvoiceSource(i.source)
        )
        for i in invoices if i.source == InvoiceSource.KRA
    ]

    # Validate that KRA upload has occurred
    # Even if there are KRA invoices, we ensure it's not empty. (If KRA file uploaded had 0 successfully parsed lines, that is checked here)
    if not kra_invoices:
         raise HTTPException(
             status_code=status.HTTP_400_BAD_REQUEST,
             detail="KRA CSV upload is required before starting reconciliation comparison."
         )

    # 4. Run reconciliation match algorithm inside transaction context
    try:
        summary, results = reconciliation_service.reconcile_sales(sap_invoices, kra_invoices)
        response = ReconciliationResponse(
            session_id=session.id,
            summary=summary,
            results=results
        )
        
        # 5. Persist comparison results to database session
        session.is_compared = True
        session.comparison_results = response.model_dump(mode="json")
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reconciliation engine failed: {str(e)}"
        )

    return response
