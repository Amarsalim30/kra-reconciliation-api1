from enum import Enum
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.models.settings import VATMapping, VatModule
from app.utils.vat_utils import normalize_vat_rate


class DocumentType(str, Enum):
    SALES = "sales"
    PURCHASES = "purchases"


class VatNormalizer:
    """
    Normalizes SAP company-specific VAT group codes to canonical percentage strings
    or "EXEMPT". Keeps reconciliation logic ERP-agnostic. Supports dynamic database mappings.
    """

    _DEFAULT_INPUT_MAP: Dict[str, str] = {
        "I1": "16",
        "I2": "0",
        "I3": "8",
        "X1": "EXEMPT",
        "N2": "16",
    }

    _DEFAULT_OUTPUT_MAP: Dict[str, str] = {
        "O1": "16",
        "O2": "0",
        "X0": "EXEMPT",
    }

    def __init__(self, input_map: Optional[Dict[str, str]] = None, output_map: Optional[Dict[str, str]] = None):
        self._input = {k.upper(): v for k, v in (input_map or self._DEFAULT_INPUT_MAP).items()}
        self._output = {k.upper(): v for k, v in (output_map or self._DEFAULT_OUTPUT_MAP).items()}

    def load_from_db(self, db: Session, connection_id: Optional[int] = None) -> None:
        """
        Dynamically reload mapping tables from active DB vat_mappings.
        """
        query = db.query(VATMapping)
        if connection_id:
            query = query.filter(VATMapping.connection_id == connection_id)

        mappings = query.all()
        if not mappings:
            return

        db_input = {}
        db_output = {}
        for m in mappings:
            display_val = m.canonical_rate
            if m.module == VatModule.PURCHASES or m.module == "purchases":
                db_input[m.sap_code.strip().upper()] = display_val
            else:
                db_output[m.sap_code.strip().upper()] = display_val

        if db_input:
            self._input = db_input
        if db_output:
            self._output = db_output

    @staticmethod
    def _normalize_raw_value(val: str) -> str:
        """
        Normalize raw VAT strings, percentages, decimals, and exempt terms.
        Distinguishes Zero Rated ('0') from Exempt ('EXEMPT').
        """
        code = val.strip().upper()
        if not code:
            return ""

        try:
            return normalize_vat_rate(val)
        except ValueError:
            return code

    def normalize(self, source: str, document_type: str, value: str, db: Optional[Session] = None) -> str:
        """
        Normalize a VAT code string.

        Args:
            source: ERP source identifier (e.g. "sap", "kra").
            document_type: "sales" or "purchases".
            value: Raw VAT code string (e.g. "I1", "O1", "16.0", "16%", "EXEMPT").
            db: Optional database session to refresh DB mappings dynamically.

        Returns:
            Normalized VAT string (e.g. "16", "8", "0", "EXEMPT").
        """
        code = value.strip().upper()
        if not code:
            return ""

        if db is not None:
            self.load_from_db(db)

        if source.lower() == "sap":
            mapping = self._input if document_type == "purchases" else self._output
            if code in mapping:
                return mapping[code]

        return self._normalize_raw_value(value)


# Module-level singleton
vat_normalizer = VatNormalizer()
