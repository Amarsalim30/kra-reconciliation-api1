import hashlib
import json

from app.domain.reconciliation_constants import EXPORT_SCHEMA_VERSION
from app.reporting.export_row import ReconciliationExportRow


def compute_sha256(rows: list[ReconciliationExportRow], schema_version: str) -> str:
    """SHA-256 over canonical JSON. Same business data → same hash always."""
    canonical = {
        "schema_version": schema_version,
        "rows": sorted([
            {
                "cu":         r.cu_number,
                "sap_inv":    r.sap_invoice_number or "",
                "kra_inv":    r.kra_invoice_number or "",
                "status":     r.status.value,
                "sap_date":   str(r.sap_invoice_date or ""),
                "sap_amount": str(r.sap_base_amount or ""),
                "sap_vat":    r.sap_vat_group or "",
                "kra_date":   str(r.kra_invoice_date or ""),
                "kra_amount": str(r.kra_base_amount or ""),
                "kra_vat":    r.kra_vat_group or "",
            }
            for r in rows
        ], key=lambda d: (d["cu"], d["sap_inv"], d["kra_inv"], d["status"])),
    }
    payload = json.dumps(canonical, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def build_status_counts(rows: list[ReconciliationExportRow]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for r in rows:
        key = r.status.value
        counts[key] = counts.get(key, 0) + 1
    return counts
