import pytest
from app.utils.vat_utils import normalize_vat_rate

def test_normalize_vat_rate_valid():
    # Valid exact strings
    assert normalize_vat_rate("16") == "16"
    assert normalize_vat_rate("8") == "8"
    assert normalize_vat_rate("0") == "0"
    
    # Decimals
    assert normalize_vat_rate("12.5") == "12.5"
    assert normalize_vat_rate("12.50") == "12.5"
    assert normalize_vat_rate("12.0") == "12"
    
    # Percentages
    assert normalize_vat_rate("16%") == "16"
    assert normalize_vat_rate(" 12.5% ") == "12.5"
    assert normalize_vat_rate("0%") == "0"
    
    # Exempt
    assert normalize_vat_rate("EXEMPT") == "EXEMPT"
    assert normalize_vat_rate("exempt") == "EXEMPT"
    assert normalize_vat_rate(" Exempt ") == "EXEMPT"

def test_normalize_vat_rate_idempotency():
    inputs = ["16", "16%", "16.0", "12.5", "12.50%", "0", "0%", "EXEMPT", "exempt"]
    for val in inputs:
        first = normalize_vat_rate(val)
        second = normalize_vat_rate(first)
        assert first == second

def test_normalize_vat_rate_invalid():
    # Negatives
    with pytest.raises(ValueError, match="cannot be negative"):
        normalize_vat_rate("-16")
        
    # Greater than 100%
    with pytest.raises(ValueError, match="cannot exceed 100"):
        normalize_vat_rate("105")
        
    # Malformed strings
    with pytest.raises(ValueError, match="Invalid VAT rate format"):
        normalize_vat_rate("VAT16")
    
    with pytest.raises(ValueError, match="Invalid VAT rate format"):
        normalize_vat_rate("abc")
        
    with pytest.raises(ValueError, match="Invalid VAT rate format"):
        normalize_vat_rate("16 percent")
        
    # Non-finite values
    with pytest.raises(ValueError, match="finite number"):
        normalize_vat_rate("Infinity")
        
    with pytest.raises(ValueError, match="finite number"):
        normalize_vat_rate("NaN")
