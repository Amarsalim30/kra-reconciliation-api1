import math
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_active_session
from app.database.database import get_db
from app.domain.reconciliation_status import ReconciliationStatus
from app.models.user import User
from app.models.reconciliation_session import SessionInvoice, SessionReconciliationResult
from app.schemas.invoice import InvoiceSource, Invoice, PaginatedInvoicesResponse
from app.schemas.reconciliation import ReconciliationResult, PaginatedReconciliationResultsResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/{session_id}/invoices", response_model=PaginatedInvoicesResponse)
def get_session_invoices(
    session_id: str,
    source: InvoiceSource = Query(..., description="SAP or KRA"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=500, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve a paginated slice of invoices loaded in the active session.
    """
    # Validate session (checks expiry and user ownership)
    session = get_active_session(session_id=session_id, db=db, current_user=current_user)

    offset = (page - 1) * limit

    # Count query
    total = db.query(func.count(SessionInvoice.id)).filter(
        SessionInvoice.session_id == session.id,
        SessionInvoice.source == source
    ).scalar()

    # Data query
    db_invoices = db.query(SessionInvoice).filter(
        SessionInvoice.session_id == session.id,
        SessionInvoice.source == source
    ).order_by(SessionInvoice.row_number).offset(offset).limit(limit).all()

    invoices = [
        Invoice(
            pin=i.pin,
            partner_name=i.partner_name,
            invoice_number=i.invoice_number,
            invoice_date=i.invoice_date,
            cu_number=i.cu_number,
            vat_group=i.vat_group,
            base_amount=i.base_amount,
            source=InvoiceSource(i.source)
        )
        for i in db_invoices
    ]

    total_pages = math.ceil(total / limit) if total > 0 else 0

    return PaginatedInvoicesResponse(
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages,
        items=invoices
    )


@router.get("/{session_id}/results", response_model=PaginatedReconciliationResultsResponse)
def get_session_reconciliation_results(
    session_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=500, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve a paginated slice of reconciliation comparison results.
    """
    # Validate session
    session = get_active_session(session_id=session_id, db=db, current_user=current_user)

    if not session.is_compared:
         raise HTTPException(
             status_code=400,
             detail="Reconciliation comparison has not been executed for this session."
         )

    offset = (page - 1) * limit

    # Count query
    total = db.query(func.count(SessionReconciliationResult.id)).filter(
        SessionReconciliationResult.session_id == session.id
    ).scalar()

    # Data query
    db_results = db.query(SessionReconciliationResult).filter(
        SessionReconciliationResult.session_id == session.id
    ).order_by(SessionReconciliationResult.row_number).offset(offset).limit(limit).all()

    results = []
    for r in db_results:
        sap_invoice = None
        if r.status != ReconciliationStatus.MISSING_IN_SAP:
            sap_invoice = Invoice(
                pin=r.sap_pin or "",
                partner_name=r.sap_partner_name or "",
                invoice_number=r.sap_invoice_number or "",
                invoice_date=r.sap_invoice_date or date.today(),
                cu_number=r.cu_number,
                vat_group=r.sap_vat_group or "0",
                base_amount=r.sap_base_amount or Decimal("0.00"),
                source=InvoiceSource.SAP
            )
            
        kra_invoice = None
        if r.status not in [ReconciliationStatus.MISSING_IN_KRA, ReconciliationStatus.MISSING_CU_NUMBER]:
            kra_invoice = Invoice(
                pin=r.kra_pin or "",
                partner_name=r.kra_partner_name or "",
                invoice_number=r.kra_invoice_number or "",
                invoice_date=r.kra_invoice_date or date.today(),
                cu_number=r.cu_number,
                vat_group=r.kra_vat_group or "0",
                base_amount=r.kra_base_amount or Decimal("0.00"),
                source=InvoiceSource.KRA
            )

        results.append(
            ReconciliationResult(
                cu_number=r.cu_number,
                sap=sap_invoice,
                kra=kra_invoice,
                status=r.status,
                amount_match=r.amount_match,
                vat_match=r.vat_match,
                date_match=r.date_match,
                partner_name_matches=r.partner_name_matches,
                pin_matches=r.pin_matches,
                differences=[] # derived by frontend, empty is safe
            )
        )

    total_pages = math.ceil(total / limit) if total > 0 else 0

    return PaginatedReconciliationResultsResponse(
        session_id=session.id,
        total=total,
        page=page,
        page_size=limit,
        total_pages=total_pages,
        items=results
    )
