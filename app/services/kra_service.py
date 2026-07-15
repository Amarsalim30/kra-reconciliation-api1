import csv
import io
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.models.settings import KRAVATMapping
from app.schemas.invoice import (
    Invoice,
    CSVValidationErrorDetail,
    FileUploadStatus,
    InvoiceUploadResponse,
    InvoiceSource,
)
from app.services.normalization import normalize_invoice_data
from app.services.settings_service import SettingsService


def parse_kra_csv(file: UploadFile, db: Session) -> InvoiceUploadResponse:
    """
    Parses a KRA CSV file, performs schema and type normalization,
    and returns a response detailing successful parses and aggregated validation errors.
    """
    settings = get_settings()

    # 1. Validate file extension
    filename = file.filename or "unknown.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are allowed."
        )

    # 2. Read content to check size and validate encoding
    try:
        content_bytes = file.file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read upload file: {str(e)}"
        )
    finally:
        file.file.seek(0)

    size_mb = len(content_bytes) / (1024 * 1024)
    if size_mb > settings.max_upload_size_mb:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds the limit of {settings.max_upload_size_mb}MB."
        )

    if len(content_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    # 3. Validate UTF-8 encoding
    try:
        content = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File encoding must be UTF-8."
        )

    # 4. Parse CSV
    f = io.StringIO(content)
    reader = csv.reader(f)
    try:
        raw_headers = next(reader)
    except StopIteration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file contains no data."
        )

    headers = [h.strip() for h in raw_headers]

    # Map headers dynamically using DB settings
    system_setting = SettingsService.get_or_create_system_settings(db)
    field_to_index = {
        "pin": system_setting.kra_csv_pin_column,
        "partner_name": system_setting.kra_csv_partner_name_column,
        "invoice_number": system_setting.kra_csv_invoice_number_column,
        "invoice_date": system_setting.kra_csv_invoice_date_column,
        "cu_number": system_setting.kra_csv_cu_number_column,
        "vat_group": system_setting.kra_csv_vat_group_column,
        "base_amount": system_setting.kra_csv_base_amount_column,
    }

    # VAT Section Mapping via filename prefix
    file_vat_rate = None
    all_vat_mappings = db.query(KRAVATMapping).all()
    for mapping in all_vat_mappings:
        if filename.upper().startswith(mapping.section_prefix.upper()):
            file_vat_rate = mapping.canonical_value.value
            break

    invoices: list[Invoice] = []
    errors: list[CSVValidationErrorDetail] = []
    total_rows = 0

    for row_idx, row in enumerate(reader, start=2):
        if not row or not any(cell.strip() for cell in row):
            continue

        total_rows += 1
        row_values = {}
        row_error_occurred = False

        for field in field_to_index.keys():
            idx = field_to_index[field]
            if idx < len(row):
                row_values[field] = row[idx]
            else:
                # Missing column index in the row
                row_values[field] = ""
                
        # Override VAT Group if derived from filename
        if file_vat_rate:
            row_values["vat_group"] = file_vat_rate

        try:
            normalized = normalize_invoice_data(
                pin=row_values["pin"],
                partner_name=row_values["partner_name"],
                invoice_number=row_values["invoice_number"],
                invoice_date=row_values["invoice_date"],
                cu_number=row_values["cu_number"],
                vat_group=row_values["vat_group"],
                base_amount=row_values["base_amount"],
                allow_negative=True
            )
            invoice = Invoice(**normalized, source=InvoiceSource.KRA)
            invoices.append(invoice)
        except ValueError as ve:
            msg = str(ve)
            msg_lower = msg.lower()
            col_name = None
            
            def safe_header(field_key):
                idx = field_to_index.get(field_key)
                if idx is not None and idx < len(headers):
                    return headers[idx]
                return field_key

            if "pin" in msg_lower:
                col_name = safe_header("pin")
            elif "customer name" in msg_lower or "partner name" in msg_lower:
                col_name = safe_header("partner_name")
            elif "invoice number" in msg_lower:
                col_name = safe_header("invoice_number")
            elif "date" in msg_lower:
                col_name = safe_header("invoice_date")
            elif "cu number" in msg_lower:
                col_name = safe_header("cu_number")
            elif "vat group" in msg_lower:
                col_name = safe_header("vat_group")
            elif "base amount" in msg_lower:
                col_name = safe_header("base_amount")

            errors.append(CSVValidationErrorDetail(
                row=row_idx,
                column=col_name,
                message=msg
            ))

    return InvoiceUploadResponse(
        filename=filename,
        rows=total_rows,
        parsed=len(invoices),
        errors_count=len(errors),
        errors=errors,
        invoices=invoices
    )


def parse_multiple_kra_csvs(
    files: list[UploadFile], db: Session
) -> tuple[list[Invoice], list[FileUploadStatus]]:
    """Parse multiple KRA CSV uploads, returning the combined invoices and per-file status."""
    all_invoices: list[Invoice] = []
    file_statuses: list[FileUploadStatus] = []
    for file in files:
        upload_res = parse_kra_csv(file, db)
        all_invoices.extend(upload_res.invoices)
        file_statuses.append(
            FileUploadStatus(
                filename=upload_res.filename,
                rows=upload_res.rows,
                parsed=upload_res.parsed,
                errors_count=upload_res.errors_count,
                errors=upload_res.errors,
            )
        )
    return all_invoices, file_statuses
