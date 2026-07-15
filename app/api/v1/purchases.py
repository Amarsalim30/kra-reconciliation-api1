from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query, UploadFile, HTTPException, status, File
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_active_session, get_sap_client
from app.database.database import get_db
from app.models.user import User
from app.models.reconciliation_session import ReconciliationSession, SessionInvoice
from app.schemas.invoice import Invoice, InvoiceSource, ReconciliationType, InvoiceFetchResponse, InvoiceUploadResponse
from app.services import invoice_service, kra_service
from app.core.sap_client import SAPClient

router = APIRouter(prefix="/purchases", tags=["purchases"])


@router.get("", response_model=InvoiceFetchResponse)
def get_purchases(
    from_date: date = Query(..., alias="from", description="Start date (YYYY-MM-DD)"),
    to_date: date = Query(..., alias="to", description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    sap_client: SAPClient = Depends(get_sap_client)
):
    """
    Fetch purchase invoices within a given date range from SAP `/PurchaseInvoices`.
    Stores the loaded invoices in a database-backed session with ReconciliationType.PURCHASES.
    """
    # 1. Global Cleanup: Clear user's expired sessions (> 30 min idle)
    expiry_time = datetime.now(timezone.utc) - timedelta(minutes=30)
    db.query(ReconciliationSession).filter(
        ReconciliationSession.user_id == current_user.id,
        ReconciliationSession.last_accessed_at < expiry_time
    ).delete()
    db.commit()

    # 2. Create a new ReconciliationSession first (gets id for log correlation)
    session = ReconciliationSession(
        user_id=current_user.id,
        from_date=from_date,
        to_date=to_date,
        session_type=ReconciliationType.PURCHASES,
        is_compared=False
    )
    db.add(session)
    db.commit()

    # 3. Fetch live SAP data
    invoices = invoice_service.get_invoices(
        from_date, to_date,
        reconciliation_type=ReconciliationType.PURCHASES,
        sap_client=sap_client,
        reconciliation_session_id=session.id
    )

    # 4. Save loaded SAP invoices relationally
    db_invoices = [
        SessionInvoice(
            session_id=session.id,
            row_number=idx + 1,
            source=inv.source,
            pin=inv.pin,
            partner_name=inv.partner_name,
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

    return InvoiceFetchResponse(
        session_id=session.id,
        source="SAP",
        count=len(invoices),
        from_date=from_date,
        to_date=to_date,
        invoices=invoices[:100]
    )


@router.post("/upload", response_model=InvoiceUploadResponse)
def upload_purchases_csv(
    files: list[UploadFile] = File(...),
    session_id: str = Query(..., description="Active reconciliation session ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload multiple KRA CSV files containing purchase invoices. Normalizes and appends records to the active session.
    """
    # 1. Validate active session using the dependency logic (checks expiry & user ownership)
    session = get_active_session(session_id=session_id, db=db, current_user=current_user)

    # 2. Enforce session validation - must be PURCHASES type
    if session.session_type != ReconciliationType.PURCHASES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active session type is not for Purchases reconciliation."
        )

    from app.services.settings_service import SettingsService
    from app.schemas.invoice import CSVValidationErrorDetail
    from app.services.kra_service import resolve_filename_to_section
    
    system_settings = SettingsService.get_or_create_system_settings(db)
    mappings = system_settings.kra_section_mappings or {}
    
    # Identify expected required sections (active and required=True)
    expected_required_sections = {
        sec_id for sec_id, config in mappings.items()
        if (isinstance(config, str) and sec_id in ("SEC_B", "SEC_F")) or
           (isinstance(config, dict) and config.get("active", True) and config.get("required", True))
    }
    matched_sections = set()
    
    invoices = []
    errors = []
    warnings = []
    total_rows = 0
    parsed_count = 0
    filenames_processed = []

    for file in files:
        filename = file.filename or "unknown.csv"
        
        matched_sec, sec_config = resolve_filename_to_section(filename, mappings)
        
        if not matched_sec:
            warnings.append(f"Skipped file '{filename}': Could not detect a valid KRA section identifier.")
            continue
            
        matched_sections.add(matched_sec)
        filenames_processed.append(filename)
        
        try:
            res = kra_service.parse_kra_csv(file, section_config=sec_config)
            total_rows += res.rows
            parsed_count += res.parsed
            invoices.extend(res.invoices)
            for err in res.errors:
                err.message = f"[{filename}] {err.message}"
                errors.append(err)
        except HTTPException:
            raise
        except Exception as e:
            errors.append(CSVValidationErrorDetail(
                row=1,
                column=None,
                message=f"[{filename}] Failed to parse: {str(e)}"
            ))

    # Check for missing expected required sections
    missing_sections = expected_required_sections - matched_sections
    for sec in missing_sections:
        display_name = sec
        config = mappings.get(sec)
        if isinstance(config, dict) and "display_name" in config:
            display_name = config["display_name"]
        warnings.append(f"Warning: Required section '{display_name}' was not found in the uploaded files.")

    # 4. Save KRA invoices to DB under the session only if there are successfully parsed invoices
    if parsed_count > 0:
        # Clear any previously uploaded KRA invoices for this session (resets state)
        db.query(SessionInvoice).filter(
            SessionInvoice.session_id == session.id,
            SessionInvoice.source == InvoiceSource.KRA
        ).delete()

        # Reset is_compared flag to prevent stale results
        session.is_compared = False
        session.comparison_results = None

        db_invoices = [
            SessionInvoice(
                session_id=session.id,
                row_number=idx + 1,
                source=inv.source,
                pin=inv.pin,
                partner_name=inv.partner_name,
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

    return InvoiceUploadResponse(
        session_id=session.id,
        filename=", ".join(filenames_processed) if filenames_processed else "None",
        rows=total_rows,
        parsed=parsed_count,
        errors_count=len(errors),
        errors=errors,
        invoices=invoices[:100],
        warnings=warnings
    )
