from decimal import Decimal, InvalidOperation

def normalize_amount(base_amount: str | float | Decimal | None, allow_negative: bool = False) -> Decimal:
    """
    Normalizes base amount to Decimal with 2 decimal places.
    Raises ValueError for invalid values or negative values when allow_negative is False.
    """
    if base_amount is None or (isinstance(base_amount, str) and not base_amount.strip()):
        raise ValueError("Base Amount is required")
        
    try:
        norm_amount = Decimal(str(base_amount).strip())
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"Invalid Base Amount '{base_amount}'. Must be a valid number.")
        
    norm_amount = norm_amount.quantize(Decimal("0.01"))
    
    if not allow_negative and norm_amount <= 0:
        raise ValueError(f"Invalid Base Amount '{base_amount}'. Must be greater than zero.")
        
    return norm_amount
