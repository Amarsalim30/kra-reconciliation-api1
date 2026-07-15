from typing import Protocol
from dataclasses import dataclass

class NormalizationRule(Protocol):
    def apply(self, value: str) -> tuple[str, bool]:
        """
        Applies the normalization rule to the input string value.
        Returns a tuple of (new_value, changed_flag).
        """
        ...

@dataclass(slots=True)
class NormalizationDiagnostics:
    original: str
    normalized: str
    applied_rules: list[str]
