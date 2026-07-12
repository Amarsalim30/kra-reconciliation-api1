from app.reporting.context import ExportContext
from app.reporting.export_format import ExportFormat
from app.reporting.export_row import to_export_rows
from app.reporting.registry import ExportStrategyRegistry
from app.reporting.artifact import ExportArtifact
from app.reporting.utils import compute_sha256, build_status_counts
from app.reporting.errors import UnsupportedExportFormatError, ReconciliationSummaryMissingError
from app.schemas.reconciliation import ReconciliationSummary

from app.models.reconciliation_session import ReconciliationSession
from app.repositories.reconciliation_repository import get_projections

from sqlalchemy.orm import Session as DbSession


def build_export(
    session: ReconciliationSession,
    db: DbSession,
    context: ExportContext,
    fmt: ExportFormat,
    registry: ExportStrategyRegistry,
) -> ExportArtifact:
    """Full export pipeline: fetch → transform → summarize → build → pack."""
    # 1. Fetch projections
    projections = get_projections(session.id, db)

    # 2. Transform to export rows
    rows = to_export_rows(projections)

    # 3. Load cached summary directly from session comparison results
    if not session.comparison_results or "summary" not in session.comparison_results:
        raise ReconciliationSummaryMissingError("Reconciliation summary is missing for compared session.")

    summary = ReconciliationSummary(**session.comparison_results["summary"])

    # 4. Dispatch to strategy
    strategy = registry.get(fmt)
    return strategy.export(rows, summary, context, session)
