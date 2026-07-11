from app.reporting.export_format import ExportFormat
from app.schemas.invoice import ReconciliationType

from app.models.reconciliation_session import ReconciliationSession


class ExportFilenameBuilder:
    def build(
        self,
        session: ReconciliationSession,
        generated_at: 'datetime',  # noqa: F821 — forward ref for datetime
        fmt: ExportFormat = ExportFormat.ZIP,
    ) -> str:
        type_label = "Sales" if session.session_type == ReconciliationType.SALES else "Purchases"
        ts = generated_at.strftime("%Y%m%dT%H%M%S.") + \
             f"{generated_at.microsecond // 1000:03d}Z"
        return (
            f"{type_label}_Reconciliation"
            f"_{session.from_date}_to_{session.to_date}"
            f"_{ts}.{fmt.value}"
        )
