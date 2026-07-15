from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import re

LEGAL_SUFFIXES = {
    "LIMITED": "",
    "LTD": "",
    "COMPANY": "",
    "CO": "",
    "PLC": "",
    "INC": "",
    "LLC": "",
}

def normalize_partner_name(name: str | None) -> str:
    """
    Normalizes a partner name for equivalence checking.
    Removes punctuation, collapses whitespace, and removes common legal suffixes.
    Returns an uppercase string.
    """
    if not name:
        return ""
    
    n = name.upper()
    # Expand common abbreviations before removing punctuation
    n = re.sub(r'\(K\)', ' KENYA ', n)
    # Replace any non-alphanumeric character with a space to prevent merging (e.g., A&B -> A B, not AB)
    n = re.sub(r'[^A-Z0-9]', ' ', n)
    
    # Split into words to handle whitespace and suffixes
    words = n.split()
    normalized_words = [w for w in words if w not in LEGAL_SUFFIXES]
    
    return " ".join(normalized_words)

def normalize_pin(pin: str | None) -> str:
    """
    Normalizes a PIN by removing all whitespace and uppercasing.
    Does not strip other characters.
    """
    if not pin:
        return ""
    return re.sub(r'\s+', '', pin.upper())

def normalize_invoice_data(
    pin: str | None,
    partner_name: str | None,
    invoice_number: str | None,
    invoice_date: str | date | datetime | None,
    cu_number: str | None,
    vat_group: str | int | float | None,
    base_amount: str | float | Decimal | None,
    allow_negative: bool = False,
    cu_serial: str | None = None
) -> dict:
    """
    Normalizes raw invoice fields and returns a dictionary matching the Invoice structure.
    Raises ValueError for fields that cannot be normalized.
    """
    # 1. PIN (Allow empty string as fallback)
    norm_pin = "" if pin is None else str(pin).strip()

    # 2. Partner Name (Allow empty string as fallback)
    norm_partner_name = "" if partner_name is None else str(partner_name).strip()

    # 3. Invoice Number
    if invoice_number is None:
        raise ValueError("Invoice Number is required")
    norm_invoice_number = str(invoice_number).strip()
    if not norm_invoice_number:
        raise ValueError("Invoice Number cannot be empty")

    # 4. Invoice Date
    if invoice_date is None:
        raise ValueError("Invoice Date is required")
    
    if isinstance(invoice_date, (date, datetime)):
        norm_date = invoice_date if isinstance(invoice_date, date) else invoice_date.date()
    else:
        date_str = str(invoice_date).strip()
        if not date_str:
            raise ValueError("Invoice Date cannot be empty")
        
        parsed_date = None
        for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
            try:
                parsed_date = datetime.strptime(date_str, fmt).date()
                break
            except ValueError:
                continue
        if parsed_date is None:
            raise ValueError(f"Invalid date format '{date_str}'. Expected DD/MM/YYYY or YYYY-MM-DD.")
        norm_date = parsed_date

    # 5. CU Number (Allow empty string as fallback)
    norm_cu = "" if cu_number is None else str(cu_number).strip().lstrip("|").strip()

    # 6. VAT Group (string representation)
    if vat_group is None or (isinstance(vat_group, str) and not vat_group.strip()):
        raise ValueError("VAT Group is required")
    
    norm_vat = str(vat_group).strip()
    # Normalize float-like groups (e.g. "16.0" -> "16")
    if norm_vat.endswith(".0"):
        norm_vat = norm_vat[:-2]
    if not norm_vat:
        raise ValueError("VAT Group cannot be empty")

    # 7. Base Amount
    if base_amount is None or (isinstance(base_amount, str) and not base_amount.strip()):
        raise ValueError("Base Amount is required")
    try:
        norm_amount = Decimal(str(base_amount).strip())
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"Invalid Base Amount '{base_amount}'. Must be a valid number.")
    
    norm_amount = norm_amount.quantize(Decimal("0.01"))

    # Validate against <= 0 base amounts unless allowed by policy/caller
    if not allow_negative and norm_amount <= 0:
        raise ValueError(f"Invalid Base Amount '{base_amount}'. Must be greater than zero.")

    norm_cu_serial = "" if cu_serial is None else str(cu_serial).strip()

    return {
        "pin": norm_pin,
        "partner_name": norm_partner_name,
        "invoice_number": norm_invoice_number,
        "invoice_date": norm_date,
        "cu_number": norm_cu,
        "vat_group": norm_vat,
        "base_amount": norm_amount,
        "cu_serial": norm_cu_serial
    }


