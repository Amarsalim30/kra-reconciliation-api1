from abc import ABC, abstractmethod

from app.reporting.artifact import ExportArtifact
from app.reporting.context import ExportContext
from app.reporting.export_row import ReconciliationExportRow
from app.schemas.reconciliation import ReconciliationSummary

from app.models.reconciliation_session import ReconciliationSession


class ExportStrategy(ABC):
    """Abstract base for export format strategies."""

    @abstractmethod
    def export(
        self,
        rows: list[ReconciliationExportRow],
        summary: ReconciliationSummary,
        context: ExportContext,
        session: ReconciliationSession,
    ) -> ExportArtifact:
        ...
