import re
import unicodedata
from app.services.normalization.base import NormalizationRule, NormalizationDiagnostics

class UnicodeNormalizerRule:
    def apply(self, value: str) -> tuple[str, bool]:
        # Filter out non-printable Unicode characters (category 'C' is Other/Control/Surrogate/Format)
        cleaned = "".join(c for c in value if unicodedata.category(c)[0] != "C")
        # Normalize Unicode representation to NFKC (maps full-width numbers and non-breaking spaces)
        normalized = unicodedata.normalize("NFKC", cleaned)
        return normalized, normalized != value

class TrimNormalizerRule:
    def apply(self, value: str) -> tuple[str, bool]:
        trimmed = value.strip()
        return trimmed, trimmed != value

class PipeNormalizerRule:
    def apply(self, value: str) -> tuple[str, bool]:
        val = value
        while val.startswith('|') or (val and val[0].isspace()):
            val = val.lstrip('|').strip()
        return val, val != value

# Register CU pipeline
CU_PIPELINE: list[NormalizationRule] = [
    UnicodeNormalizerRule(),
    TrimNormalizerRule(),
    PipeNormalizerRule(),
]

def normalize_cu_number_with_diagnostics(cu_number: str | None) -> NormalizationDiagnostics:
    """
    Normalizes a Control Unit (CU) number with full rule execution diagnostics.
    """
    if cu_number is None:
        return NormalizationDiagnostics(original="", normalized="", applied_rules=[])
    
    orig = str(cu_number)
    value = orig
    applied_rules = []
    
    # 1. Unicode Normalizer
    rule1 = UnicodeNormalizerRule()
    value, changed = rule1.apply(value)
    if changed:
        applied_rules.append("unicode_nfkc")
        
    # 2. Trim Normalizer
    rule2 = TrimNormalizerRule()
    value, changed = rule2.apply(value)
    if changed:
        applied_rules.append("trim")
        
    # 3. Pipe Normalizer
    rule3 = PipeNormalizerRule()
    value, changed = rule3.apply(value)
    if changed:
        applied_rules.append("remove_leading_pipes")
        
    return NormalizationDiagnostics(
        original=orig,
        normalized=value,
        applied_rules=applied_rules
    )

def normalize_cu_number(cu_number: str | None) -> str:
    """
    Normalizes a Control Unit (CU) number. Maintains standard string return signature.
    """
    return normalize_cu_number_with_diagnostics(cu_number).normalized
