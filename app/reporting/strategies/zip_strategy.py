from app.reporting.artifact import ExportArtifact
from app.reporting.context import ExportContext

from app.reporting.export_filename_builder import ExportFilenameBuilder
from app.reporting.export_format import ExportFormat
from app.reporting.export_row import ReconciliationExportRow
from app.reporting.strategies.base import ExportStrategy
from app.reporting.utils import compute_sha256, build_status_counts
from app.reporting.workbook_artifact import WorkbookArtifact
from app.reporting.workbook_builder import build_all as build_workbooks
from app.reporting.zip_builder import pack as pack_zip
from app.schemas.reconciliation import ReconciliationSummary

from app.models.reconciliation_session import ReconciliationSession


class ZipExporter(ExportStrategy):
    """Strategy that produces a ZIP archive containing Excel workbooks."""

    def export(
        self,
        rows: list[ReconciliationExportRow],
        summary: ReconciliationSummary,
        context: ExportContext,
        session: ReconciliationSession,
    ) -> ExportArtifact:
        filename_builder = ExportFilenameBuilder()
        filename = filename_builder.build(session, context.generated_at, ExportFormat.ZIP)

        workbook_artifacts = build_workbooks(rows, summary, context, session)



        sha256 = compute_sha256(rows, context.export_version)
        status_counts = build_status_counts(rows)

        metadata = {
            "row_count": len(rows),
            "sha256": sha256,
            "status_counts": status_counts,
        }

        content = pack_zip(workbook_artifacts, metadata, session, context)

        return ExportArtifact(
            filename=filename,
            media_type="application/zip",
            content=content,
        )
