from datetime import date, datetime
from decimal import Decimal
from app.services.normalization.pin import normalize_pin
from app.services.normalization.partner import normalize_partner_name
from app.services.normalization.cu import normalize_cu_number
from app.services.normalization.vat import normalize_vat_group
from app.services.normalization.amount import normalize_amount

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
    Normalizes raw invoice fields immediately at ingestion into the canonical representation dictionary.
    """
    # 1. PIN (Canonical: normalized PIN, fallback empty string)
    norm_pin = normalize_pin(pin)
    
    # 2. Partner Name (Canonical: trimmed string, original stored for display)
    norm_partner_name = "" if partner_name is None else str(partner_name).strip()
    
    # 3. Invoice Number
    if invoice_number is None:
        raise ValueError("Invoice Number is required")
    norm_invoice_number = str(invoice_number).strip()
    while norm_invoice_number.startswith('|'):
        norm_invoice_number = norm_invoice_number.lstrip('|').strip()
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
        
    # 5. CU Number (Canonical: normalized CU number)
    norm_cu = normalize_cu_number(cu_number)
    
    # 6. VAT Group (Canonical: normalized VAT group)
    norm_vat = normalize_vat_group(vat_group)
    
    # 7. Base Amount (Canonical: normalized amount)
    norm_amount = normalize_amount(base_amount, allow_negative)
    
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
