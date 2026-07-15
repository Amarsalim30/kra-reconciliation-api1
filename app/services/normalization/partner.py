import re
from app.services.normalization.base import NormalizationDiagnostics
from app.services.normalization.constants.partner import (
    LEGAL_SUFFIXES,
    GEOGRAPHIC_SUFFIXES,
    STOP_WORDS,
    ALLOWED_EXPANSIONS
)

def normalize_partner_name_with_diagnostics(name: str | None) -> NormalizationDiagnostics:
    """
    Normalizes a partner name with rules and records diagnostics.
    """
    if not name:
        return NormalizationDiagnostics(original="", normalized="", applied_rules=[])
        
    orig = str(name)
    value = orig.upper()
    applied_rules = []
    
    # 1. Expand (K) to KENYA
    if "(K)" in value:
        value = re.sub(r'\(K\)', ' KENYA ', value)
        applied_rules.append("expand_k")
        
    # 2. Clean punctuation
    cleaned = re.sub(r'[^A-Z0-9]', ' ', value)
    if cleaned != value:
        value = cleaned
        applied_rules.append("remove_punctuation")
        
    # Collapse spaces
    words = value.split()
    
    # 3. Strip legal suffixes
    stripped_suffix = False
    while words and words[-1] in LEGAL_SUFFIXES:
        words.pop()
        stripped_suffix = True
    if stripped_suffix:
        applied_rules.append("remove_legal_suffixes")
        
    # 4. Strip geographic suffixes
    stripped_geo = False
    while words and words[-1] in GEOGRAPHIC_SUFFIXES:
        words.pop()
        stripped_geo = True
    if stripped_geo:
        applied_rules.append("remove_geographic_suffixes")
        
    # Strip legal suffixes again (just in case they are nested)
    stripped_suffix_nested = False
    while words and words[-1] in LEGAL_SUFFIXES:
        words.pop()
        stripped_suffix_nested = True
    if stripped_suffix_nested:
        applied_rules.append("remove_legal_suffixes_nested")
        
    normalized = " ".join(words)
    return NormalizationDiagnostics(
        original=orig,
        normalized=normalized,
        applied_rules=applied_rules
    )

def normalize_partner_name(name: str | None) -> str:
    """
    Normalizes a partner name. Returns string.
    """
    return normalize_partner_name_with_diagnostics(name).normalized

def tokenize_partner_name(name: str) -> list[str]:
    """
    Tokenizes a partner name, normalizes it, and removes stop words.
    """
    norm = normalize_partner_name(name)
    words = norm.split()
    return [w for w in words if w not in STOP_WORDS]

def partner_names_match(name1: str | None, name2: str | None) -> bool:
    """
    Determines equivalence between two partner names using token prefix-expansion matching.
    """
    if not name1 or not name2:
        return False
        
    tokens1 = tokenize_partner_name(name1)
    tokens2 = tokenize_partner_name(name2)
    
    if not tokens1 or not tokens2:
        return False
        
    if tokens1 == tokens2:
        return True
        
    if len(tokens1) < len(tokens2):
        shorter, longer = tokens1, tokens2
    else:
        shorter, longer = tokens2, tokens1
        
    # Shorter must be a prefix of longer
    if longer[:len(shorter)] != shorter:
        return False
        
    # Shorter has length 1: require exact match to prevent false positives
    if len(shorter) == 1:
        return shorter[0] == longer[0]
        
    # Extra tokens must all be in ALLOWED_EXPANSIONS
    extra_tokens = longer[len(shorter):]
    return all(t in ALLOWED_EXPANSIONS for t in extra_tokens)
