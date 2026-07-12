import json
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from app.domain.reconciliation_constants import EXPORT_SCHEMA_VERSION, STATUS_PRIORITY_VERSION
from app.reporting.context import ExportContext
from app.reporting.export_row import ReconciliationExportRow
from app.reporting.workbook_artifact import WorkbookArtifact
from app.schemas.reconciliation import ReconciliationSummary

from app.models.reconciliation_session import ReconciliationSession


def pack(
    workbook_artifacts: list[WorkbookArtifact],
    metadata_artifacts: dict,
    session: ReconciliationSession,
    context: ExportContext,
) -> BytesIO:
    """Assemble all artifacts into a single ZIP BytesIO, seeked to 0."""
    buf = BytesIO()

    with ZipFile(buf, "w", ZIP_DEFLATED) as zf:
        # _metadata.json
        export_json = {
            "schema_version": context.export_version,
            "status_priority_version": STATUS_PRIORITY_VERSION,
            "generated_at": context.generated_at.isoformat(),
            "generated_by": context.generated_by,
            "application_version": context.app_version,
            "session_id": session.id,
            "session_type": session.session_type.value,
            "company": getattr(session, "company_db", None),
            "date_range": {
                "from": str(session.from_date),
                "to": str(session.to_date),
            },
            "checksum": metadata_artifacts.get("sha256", ""),
            "record_counts": {
                "matches": metadata_artifacts.get("status_counts", {}).get("Match", 0),
                "exceptions": metadata_artifacts.get("row_count", 0) - metadata_artifacts.get("status_counts", {}).get("Match", 0),
            }
        }
        zf.writestr("_metadata.json", json.dumps(export_json, indent=2, ensure_ascii=False))

        # Workbook artifacts
        for artifact in workbook_artifacts:
            zf.writestr(artifact.zip_path, artifact.content)

    buf.seek(0)
    return buf
