from dataclasses import dataclass
from datetime import datetime, timezone

from app.domain.reconciliation_constants import EXPORT_SCHEMA_VERSION


@dataclass(frozen=True)
class ExportContext:
    """Export-level metadata common to all sessions.

    frozen=True prevents accidental mutation. company is read from
    session.company_db inside the strategy — not stored here.
    """

    generated_by:   str
    app_version:    str
    generated_at:   datetime  # timezone-aware (UTC); set once by router
    export_version: str = EXPORT_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if self.generated_at.tzinfo is None:
            raise ValueError(
                "generated_at must be timezone-aware (UTC). "
                "Use datetime.now(timezone.utc), not datetime.utcnow()."
            )
