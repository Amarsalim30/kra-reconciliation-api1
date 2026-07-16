from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.reconciliation_session import ReconciliationSession, SessionInvoice
from app.schemas.invoice import (
    Invoice,
    InvoiceSource,
    ReconciliationType,
)
from app.services import invoice_service, kra_service
from app.services.settings_service import SettingsService

SESSION_EXPIRY_MINUTES = 30


def _save_invoices(db: Session, session_id: str, invoices: list[Invoice], source: InvoiceSource) -> None:
    db_invoices = [
        SessionInvoice(
            session_id=session_id,
            row_number=idx + 1,
            source=inv.source,
            pin=inv.pin,
            partner_name=inv.partner_name,
            invoice_number=inv.invoice_number,
            invoice_date=inv.invoice_date,
            cu_number=inv.cu_number,
            vat_group=inv.vat_group,
            base_amount=inv.base_amount,
        )
        for idx, inv in enumerate(invoices)
    ]
    db.add_all(db_invoices)
    db.commit()


def load_sap_invoices(
    db: Session,
    current_user,
    sap_client,
    reconciliation_type: ReconciliationType,
    from_date: date,
    to_date: date,
):
    """Fetch SAP invoices for a date range, create a session, and persist them."""
    expiry_time = datetime.now(timezone.utc) - timedelta(minutes=SESSION_EXPIRY_MINUTES)
    db.query(ReconciliationSession).filter(
        ReconciliationSession.user_id == current_user.id,
        ReconciliationSession.last_accessed_at < expiry_time,
    ).delete()
    db.commit()

    session = ReconciliationSession(
        user_id=current_user.id,
        from_date=from_date,
        to_date=to_date,
        session_type=reconciliation_type,
        is_compared=False,
    )
    db.add(session)
    db.commit()

    system_setting = SettingsService.get_or_create_system_settings(db)
    invoices = invoice_service.get_invoices(
        from_date,
        to_date,
        reconciliation_type=reconciliation_type,
        sap_client=sap_client,
        reconciliation_session_id=session.id,
        purchase_cu_source=system_setting.purchase_cu_source,
    )

    _save_invoices(db, session.id, invoices, InvoiceSource.SAP)

    return {
        "session_id": session.id,
        "source": "SAP",
        "count": len(invoices),
        "from_date": from_date,
        "to_date": to_date,
        "invoices": invoices[:100],
    }


def upload_kra_csvs(
    db: Session,
    current_user,
    reconciliation_type: ReconciliationType,
    files: list,
    session_id: str,
):
    """Validate the active session, parse KRA CSVs, and replace stored KRA invoices."""
    from app.core.dependencies import get_active_session

    session = get_active_session(session_id=session_id, db=db, current_user=current_user)
    if session.session_type != reconciliation_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Active session type is not for {reconciliation_type.value.capitalize()} reconciliation.",
        )

    all_invoices, file_statuses = kra_service.parse_multiple_kra_csvs(files, db)

    if all_invoices:
        db.query(SessionInvoice).filter(
            SessionInvoice.session_id == session.id,
            SessionInvoice.source == InvoiceSource.KRA,
        ).delete()
        session.is_compared = False
        session.comparison_results = None
        _save_invoices(db, session.id, all_invoices, InvoiceSource.KRA)

    return {
        "session_id": session.id,
        "files": file_statuses,
        "invoices": all_invoices[:100],
    }
