from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.domain.reconciliation_constants import REMARK_MAP
from app.domain.reconciliation_status import ReconciliationStatus
from app.repositories.projections import ReconciliationProjection


@dataclass(frozen=True)
class ReconciliationExportRow:
    """Reporting-layer DTO. Carries derived presentation fields (remark).

    Lives in reporting/, not domain/ — it belongs to the export layer.
    """

    cu_number:           str
    status:              ReconciliationStatus
    remark:              str         # derived from REMARK_MAP at export time
    amount_match:        bool
    vat_match:           bool
    date_match:          bool
    sap_invoice_number:  str | None
    sap_partner_name:    str | None
    sap_pin:             str | None
    sap_invoice_date:    date | None
    sap_base_amount:     Decimal | None
    sap_vat_group:       str | None
    kra_invoice_number:  str | None
    kra_partner_name:    str | None
    kra_pin:             str | None
    kra_invoice_date:    date | None
    kra_base_amount:     Decimal | None
    kra_vat_group:       str | None


def to_export_rows(projections: list[ReconciliationProjection]) -> list[ReconciliationExportRow]:
    """Explicit constructor — no reflection. Future field additions are compile-time errors."""
    return [
        ReconciliationExportRow(
            cu_number=p.cu_number,
            status=p.status,
            remark=REMARK_MAP[p.status],
            amount_match=p.amount_match,
            vat_match=p.vat_match,
            date_match=p.date_match,
            sap_invoice_number=p.sap_invoice_number,
            sap_partner_name=p.sap_partner_name,
            sap_pin=p.sap_pin,
            sap_invoice_date=p.sap_invoice_date,
            sap_base_amount=p.sap_base_amount,
            sap_vat_group=p.sap_vat_group,
            kra_invoice_number=p.kra_invoice_number,
            kra_partner_name=p.kra_partner_name,
            kra_pin=p.kra_pin,
            kra_invoice_date=p.kra_invoice_date,
            kra_base_amount=p.kra_base_amount,
            kra_vat_group=p.kra_vat_group,
        )
        for p in projections
    ]
