from enum import Enum
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.models.settings import SAPVatMapping, VATBucket


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
        Dynamically reload mapping tables from active DB sap_vat_mappings.
        """
        query = db.query(SAPVatMapping)
        if connection_id:
            query = query.filter(SAPVatMapping.connection_id == connection_id)

        mappings = query.all()
        if not mappings:
            return

        db_input = {}
        db_output = {}
        for m in mappings:
            display_val = m.vat_bucket.code if m.vat_bucket else "EXEMPT"
            if m.vat_bucket and m.vat_bucket.percentage is not None:
                pct = m.vat_bucket.percentage
                display_val = str(int(pct)) if (pct % 1 == 0) else str(pct)
            elif m.vat_bucket and m.vat_bucket.code == "EXEMPT":
                display_val = "EXEMPT"

            code_upper = m.sap_code.strip().upper()
            if m.module == "purchases":
                db_input[code_upper] = display_val
            else:
                db_output[code_upper] = display_val

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

        # Check for Exempt terms (takes precedence over 0%/numeric format)
        if code in ("EXEMPT", "EXEMPTED", "EXEMPTION", "EX", "E") or "EXEMPT" in code:
            return "EXEMPT"

        # Clean percentage signs and whitespace
        clean_code = code.rstrip("%").strip()

        # Handle numeric percentage strings (e.g. "16.0", "16.00", "8.0", "0.0", "0")
        try:
            num = float(clean_code)
            if num.is_integer():
                return str(int(num))
            return str(num)
        except ValueError:
            pass

        return clean_code

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
