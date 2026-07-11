from enum import Enum


class DocumentType(str, Enum):
    SALES = "sales"
    PURCHASES = "purchases"


class VatNormalizer:
    """
    Normalizes SAP company-specific VAT group codes to canonical percentage strings
    or "EXEMPT". Keeps reconciliation logic ERP-agnostic.
    """

    # Input VAT (A/P — Purchases)
    _INPUT_MAP: dict[str, str] = {
        "I1": "16",
        "I2": "0",
        "I3": "8",
        "X1": "EXEMPT",
    }

    # Output VAT (A/R — Sales)
    _OUTPUT_MAP: dict[str, str] = {
        "O1": "16",
        "O2": "0",
        "X0": "EXEMPT",
    }

    def __init__(self, input_map: dict[str, str] | None = None, output_map: dict[str, str] | None = None):
        self._input = {k.upper(): v for k, v in (input_map or self._INPUT_MAP).items()}
        self._output = {k.upper(): v for k, v in (output_map or self._OUTPUT_MAP).items()}

    def normalize(self, source: str, document_type: str, value: str) -> str:
        """
        Normalize a VAT code.

        Args:
            source: ERP source identifier (e.g. "sap"). Currently only "sap" is mapped.
            document_type: "sales" or "purchases".
            value: Raw VAT code string (e.g. "I1", "O1", "16").

        Returns:
            Normalized VAT string (e.g. "16", "0", "EXEMPT").
            If no mapping matches, returns the stripped original value.
        """
        code = value.strip().upper()
        if not code:
            return ""

        if source.lower() == "sap":
            mapping = self._input if document_type == "purchases" else self._output
            return mapping.get(code, value.strip())

        return value.strip()


# Module-level singleton
vat_normalizer = VatNormalizer()
