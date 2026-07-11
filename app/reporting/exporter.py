from app.reporting.context import ExportContext
from app.reporting.export_format import ExportFormat
from app.reporting.export_row import to_export_rows
from app.reporting.registry import ExportStrategyRegistry
from app.reporting.artifact import ExportArtifact
from app.reporting.utils import compute_sha256, build_status_counts
from app.services.summary_service import build_summary

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

    # 3. Build summary — prefer cached totals from session comparison
    if session.comparison_results and "summary" in session.comparison_results:
        summary_data = session.comparison_results["summary"]
        total_sap = summary_data.get("total_sap", len(rows))
        total_kra = summary_data.get("total_kra", len(rows))
    else:
        total_sap = len(rows)
        total_kra = len(rows)

    summary = build_summary(rows, total_sap, total_kra)

    # 4. Dispatch to strategy
    strategy = registry.get(fmt)
    return strategy.export(rows, summary, context, session)
