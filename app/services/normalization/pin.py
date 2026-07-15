import re

def normalize_pin(pin: str | None) -> str:
    """
    Normalizes a PIN by removing all whitespace and converting to uppercase.
    """
    if not pin:
        return ""
    return re.sub(r'\s+', '', pin.upper())
