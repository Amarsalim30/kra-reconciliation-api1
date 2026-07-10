import csv
import io
from fastapi import UploadFile, HTTPException, status

from app.core.config import get_settings
from app.core.csv_aliases import FIELD_ALIASES
from app.schemas.invoice import Invoice, CSVValidationErrorDetail, InvoiceUploadResponse, InvoiceSource
from app.services.normalization import normalize_invoice_data


def parse_kra_csv(file: UploadFile) -> InvoiceUploadResponse:
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

    # Check for duplicate headers
    seen_headers = set()
    duplicate_headers = []
    for h in headers:
        if h:
            h_lower = h.lower()
            if h_lower in seen_headers:
                duplicate_headers.append(h)
            seen_headers.add(h_lower)

    if duplicate_headers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV file contains duplicate headers: {', '.join(duplicate_headers)}"
        )

    # Map headers dynamically using FIELD_ALIASES (case-insensitive and trimmed)
    field_to_index = {}
    for idx, h in enumerate(headers):
        if not h:
            continue
        h_norm = h.strip().lower()
        for field, aliases in FIELD_ALIASES.items():
            if any(alias.strip().lower() == h_norm for alias in aliases):
                if field not in field_to_index:
                    field_to_index[field] = idx
                break

    # Check that all required schema fields are mapped
    required_fields = ["pin", "partner_name", "invoice_number", "invoice_date", "cu_number", "vat_group", "base_amount"]
    missing_fields = [f for f in required_fields if f not in field_to_index]
    if missing_fields:
        # Map user-friendly names for missing columns error message
        friendly_names = {
            "pin": "PIN Number",
            "partner_name": "Partner/Customer/Supplier Name",
            "invoice_number": "Invoice Number",
            "invoice_date": "Invoice Date",
            "cu_number": "CU Number",
            "vat_group": "VAT Group",
            "base_amount": "Base Amount"
        }
        missing_friendly = [friendly_names.get(f, f) for f in missing_fields]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required columns in CSV: {', '.join(missing_friendly)}"
        )

    invoices: list[Invoice] = []
    errors: list[CSVValidationErrorDetail] = []
    seen_invoices = set()
    seen_cu_numbers = set()
    total_rows = 0

    for row_idx, row in enumerate(reader, start=2):
        if not row or not any(cell.strip() for cell in row):
            continue

        total_rows += 1
        row_values = {}
        row_error_occurred = False

        for field in required_fields:
            idx = field_to_index[field]
            if idx < len(row):
                row_values[field] = row[idx]
            else:
                errors.append(CSVValidationErrorDetail(
                    row=row_idx,
                    column=headers[idx] if idx < len(headers) else field,
                    message=f"Missing column value for {field}"
                ))
                row_error_occurred = True

        if row_error_occurred:
            continue

        raw_cu = str(row_values["cu_number"]).strip().lstrip("|").strip()
        inv_num = str(row_values["invoice_number"]).strip()

        if raw_cu:
            if raw_cu in seen_cu_numbers:
                errors.append(CSVValidationErrorDetail(
                    row=row_idx,
                    column=headers[field_to_index["cu_number"]],
                    message=f"Duplicate CU Number '{raw_cu}' found in CSV upload"
                ))
                row_error_occurred = True
            else:
                seen_cu_numbers.add(raw_cu)

        if inv_num:
            if inv_num in seen_invoices:
                errors.append(CSVValidationErrorDetail(
                    row=row_idx,
                    column=headers[field_to_index["invoice_number"]],
                    message=f"Duplicate invoice number '{inv_num}' found in CSV upload"
                ))
                row_error_occurred = True
            else:
                seen_invoices.add(inv_num)

        if row_error_occurred:
            continue

        try:
            normalized = normalize_invoice_data(
                pin=row_values["pin"],
                partner_name=row_values["partner_name"],
                invoice_number=row_values["invoice_number"],
                invoice_date=row_values["invoice_date"],
                cu_number=row_values["cu_number"],
                vat_group=row_values["vat_group"],
                base_amount=row_values["base_amount"]
            )
            invoice = Invoice(**normalized, source=InvoiceSource.KRA)
            invoices.append(invoice)
        except ValueError as ve:
            msg = str(ve)
            msg_lower = msg.lower()
            col_name = None
            if "pin" in msg_lower:
                col_name = headers[field_to_index["pin"]]
            elif "customer name" in msg_lower or "partner name" in msg_lower:
                col_name = headers[field_to_index["partner_name"]]
            elif "invoice number" in msg_lower:
                col_name = headers[field_to_index["invoice_number"]]
            elif "date" in msg_lower:
                col_name = headers[field_to_index["invoice_date"]]
            elif "cu number" in msg_lower:
                col_name = headers[field_to_index["cu_number"]]
            elif "vat group" in msg_lower:
                col_name = headers[field_to_index["vat_group"]]
            elif "base amount" in msg_lower:
                col_name = headers[field_to_index["base_amount"]]

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
