import csv
import io
from fastapi import UploadFile, HTTPException, status

from app.core.config import get_settings
from app.core.csv_aliases import FIELD_ALIASES
from app.schemas.invoice import Invoice, CSVValidationErrorDetail, InvoiceUploadResponse, InvoiceSource
from app.services.normalization import normalize_invoice_data


import re

def resolve_filename_to_section(filename: str, mappings: dict) -> tuple[str | None, dict | None]:
    """
    Given a filename and the mappings dictionary (from system settings),
    finds the first active section whose regex pattern matches the filename.
    Returns (section_id, section_config_dict) if matched, else (None, None).
    """
    filename_upper = filename.upper()
    for sec_id, config in mappings.items():
        # Legacy fallback
        if isinstance(config, str):
            config = {
                "identifier": sec_id,
                "display_name": f"Section {sec_id.split('_')[-1]}",
                "filename_regex": f"(?i).*sec[_-]?{sec_id.split('_')[-1].lower()}.*",
                "vat_group": config,
                "required": sec_id in ("SEC_B", "SEC_F"),
                "column_mapping": {
                    "pin": 0 if sec_id == "SEC_B" else 1,
                    "partner_name": 1 if sec_id == "SEC_B" else 2,
                    "invoice_number": 2 if sec_id == "SEC_B" else 4,
                    "invoice_date": 3,
                    "cu_number": 4,
                    "base_amount": 6 if sec_id == "SEC_B" else 7,
                },
                "validation_rules": {
                    "pin_required": True,
                    "allow_negative_amounts": False
                },
                "active": True
            }

        # Check active status
        if not config.get("active", True):
            continue

        regex_pattern = config.get("filename_regex")
        if not regex_pattern:
            continue

        try:
            pattern = re.compile(regex_pattern)
            if pattern.search(filename):
                return sec_id, config
        except Exception:
            continue

    # Fallback check for exact substrings in filename
    for sec_id, config in mappings.items():
        if isinstance(config, str):
            if sec_id.upper() in filename_upper:
                # Synthesize fallback config
                return sec_id, {
                    "identifier": sec_id,
                    "display_name": f"Section {sec_id.split('_')[-1]}",
                    "filename_regex": f"(?i).*sec[_-]?{sec_id.split('_')[-1].lower()}.*",
                    "vat_group": config,
                    "required": sec_id in ("SEC_B", "SEC_F"),
                    "column_mapping": {
                        "pin": 0 if sec_id == "SEC_B" else 1,
                        "partner_name": 1 if sec_id == "SEC_B" else 2,
                        "invoice_number": 2 if sec_id == "SEC_B" else 4,
                        "invoice_date": 3,
                        "cu_number": 4,
                        "base_amount": 6 if sec_id == "SEC_B" else 7,
                    },
                    "validation_rules": {
                        "pin_required": True,
                        "allow_negative_amounts": False
                    },
                    "active": True
                }
        elif isinstance(config, dict) and config.get("active", True):
            if sec_id.upper() in filename_upper:
                return sec_id, config

    return None, None


def parse_kra_csv(file: UploadFile, mapped_vat_group: str = None, section_config: dict = None) -> InvoiceUploadResponse:
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
        first_row = next(reader)
    except StopIteration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CSV file contains no data."
        )

    # Automatically detect if the first row is a header row
    is_header = False
    for cell in first_row:
        cell_norm = cell.strip().lower()
        for field, aliases in FIELD_ALIASES.items():
            if any(alias.strip().lower() == cell_norm for alias in aliases):
                is_header = True
                break
        if is_header:
            break

    if is_header:
        headers = [h.strip() for h in first_row]
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

        # Map headers dynamically using FIELD_ALIASES
        header_to_index = {}
        for idx, h in enumerate(headers):
            if not h:
                continue
            h_norm = h.strip().lower()
            for field, aliases in FIELD_ALIASES.items():
                if any(alias.strip().lower() == h_norm for alias in aliases):
                    if field not in header_to_index:
                        header_to_index[field] = idx
                    break
        data_rows = list(reader)
        start_row_idx = 2
    else:
        headers = [f"Column_{i}" for i in range(len(first_row))]
        header_to_index = {}
        data_rows = [first_row] + list(reader)
        start_row_idx = 1

    # Resolve configuration options
    if not section_config and mapped_vat_group:
        section_config = {
            "vat_group": mapped_vat_group,
            "validation_rules": {
                "pin_required": True,
                "allow_negative_amounts": False
            }
        }

    col_mapping = {}
    val_rules = {}
    vat_group_from_config = None

    if section_config:
        col_mapping = section_config.get("column_mapping", {})
        val_rules = section_config.get("validation_rules", {})
        vat_group_from_config = section_config.get("vat_group")

    pin_required = val_rules.get("pin_required", True)
    allow_negative = val_rules.get("allow_negative_amounts", False)

    invoices: list[Invoice] = []
    errors: list[CSVValidationErrorDetail] = []
    total_rows = 0

    for row_idx, row in enumerate(data_rows, start=start_row_idx):
        if not row or not any(cell.strip() for cell in row):
            continue

        total_rows += 1
        row_error_occurred = False

        def get_field_val(field_name: str, default_idx: int) -> str | None:
            # 1. Check section config index mapping first
            mapped_idx = col_mapping.get(field_name)
            if mapped_idx is not None:
                if mapped_idx < len(row):
                    return row[mapped_idx]
                else:
                    return None
            # 2. Check dynamic header mapping if available
            if is_header and field_name in header_to_index:
                idx = header_to_index[field_name]
                if idx < len(row):
                    return row[idx]
                else:
                    return None
            # 3. Fallback to default index if within bounds
            if default_idx < len(row):
                return row[default_idx]
            return None

        # Detect if we should use Sales defaults or Purchases defaults
        is_sales_like = section_config and section_config.get("identifier") == "SEC_B"
        default_pin_idx = 0 if is_sales_like else 1
        default_name_idx = 1 if is_sales_like else 2
        default_num_idx = 2 if is_sales_like else 4
        default_date_idx = 3
        default_cu_idx = 4
        default_amount_idx = 6 if is_sales_like else 7

        pin_val = get_field_val("pin", default_pin_idx)
        name_val = get_field_val("partner_name", default_name_idx)
        num_val = get_field_val("invoice_number", default_num_idx)
        date_val = get_field_val("invoice_date", default_date_idx)
        cu_val = get_field_val("cu_number", default_cu_idx)
        amount_val = get_field_val("base_amount", default_amount_idx)

        # Fallback for Invoice Number if missing
        if not num_val:
            num_val = cu_val

        # Resolve VAT Group
        vat_val = vat_group_from_config
        if not vat_val:
            vat_val = get_field_val("vat_group", 5)

        try:
            if pin_required and (pin_val is None or not str(pin_val).strip()):
                raise ValueError("PIN Number is required")

            normalized = normalize_invoice_data(
                pin=pin_val,
                partner_name=name_val or "",
                invoice_number=num_val,
                invoice_date=date_val,
                cu_number=cu_val,
                vat_group=vat_val,
                base_amount=amount_val,
                allow_negative=allow_negative
            )
            invoice = Invoice(**normalized, source=InvoiceSource.KRA)
            invoices.append(invoice)
        except ValueError as ve:
            msg = str(ve)
            msg_lower = msg.lower()
            col_name = "Unknown"

            def get_col_header(field_name: str, default_name: str) -> str:
                idx = col_mapping.get(field_name)
                if idx is not None and idx < len(headers):
                    return headers[idx]
                if is_header and field_name in header_to_index:
                    return headers[header_to_index[field_name]]
                return default_name

            if "pin" in msg_lower:
                col_name = get_col_header("pin", "PIN Number")
            elif "customer name" in msg_lower or "partner name" in msg_lower:
                col_name = get_col_header("partner_name", "Partner Name")
            elif "invoice number" in msg_lower:
                col_name = get_col_header("invoice_number", "Invoice Number")
            elif "date" in msg_lower:
                col_name = get_col_header("invoice_date", "Invoice Date")
            elif "cu number" in msg_lower:
                col_name = get_col_header("cu_number", "CU Number")
            elif "vat group" in msg_lower:
                col_name = get_col_header("vat_group", "VAT Group")
            elif "base amount" in msg_lower:
                col_name = get_col_header("base_amount", "Base Amount")

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
