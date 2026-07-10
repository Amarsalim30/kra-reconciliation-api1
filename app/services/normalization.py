from datetime import date, datetime
from decimal import Decimal, InvalidOperation

def normalize_invoice_data(
    pin: str | None,
    customer_name: str | None,
    invoice_number: str | None,
    invoice_date: str | date | datetime | None,
    cu_number: str | None,
    vat_group: str | int | float | None,
    base_amount: str | float | Decimal | None
) -> dict:
    """
    Normalizes raw sales invoice fields and returns a dictionary matching SalesInvoice structure.
    Raises ValueError for fields that cannot be normalized.
    """
    # 1. PIN
    if pin is None:
        raise ValueError("PIN is required")
    norm_pin = str(pin).strip()
    if not norm_pin:
        raise ValueError("PIN cannot be empty")

    # 2. Customer Name
    if customer_name is None:
        raise ValueError("Customer Name is required")
    norm_customer_name = str(customer_name).strip()
    if not norm_customer_name:
        raise ValueError("Customer Name cannot be empty")

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

    # 5. CU Number
    if cu_number is None:
        raise ValueError("CU Number is required")
    norm_cu = str(cu_number).strip().lstrip("|").strip()
    if not norm_cu:
        raise ValueError("CU Number cannot be empty")

    # 6. VAT Group
    if vat_group is None or (isinstance(vat_group, str) and not vat_group.strip()):
        raise ValueError("VAT Group is required")
    try:
        norm_vat = int(float(str(vat_group).strip()))
    except (ValueError, TypeError):
        raise ValueError(f"Invalid VAT Group '{vat_group}'. Must be an integer.")

    # 7. Base Amount
    if base_amount is None or (isinstance(base_amount, str) and not base_amount.strip()):
        raise ValueError("Base Amount is required")
    try:
        norm_amount = Decimal(str(base_amount).strip())
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"Invalid Base Amount '{base_amount}'. Must be a valid number.")
    
    norm_amount = norm_amount.quantize(Decimal("0.01"))

    return {
        "pin": norm_pin,
        "customer_name": norm_customer_name,
        "invoice_number": norm_invoice_number,
        "invoice_date": norm_date,
        "cu_number": norm_cu,
        "vat_group": norm_vat,
        "base_amount": norm_amount
    }
