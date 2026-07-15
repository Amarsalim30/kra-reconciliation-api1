def normalize_vat_group(vat_group: str | int | float | None) -> str:
    """
    Normalizes a VAT Group representation:
    - Converts to string, strips whitespace, converts to uppercase.
    - Normalizes float-like strings (e.g. "16.0" -> "16").
    """
    if vat_group is None or (isinstance(vat_group, str) and not vat_group.strip()):
        raise ValueError("VAT Group is required")
        
    val = str(vat_group).strip().upper()
    if val.endswith(".0"):
        val = val[:-2]
        
    if not val:
        raise ValueError("VAT Group cannot be empty")
        
    return val
