class UnsupportedExportFormatError(Exception):
    """Raised when no strategy is registered for the requested ExportFormat."""


class ReconciliationSummaryMissingError(Exception):
    """Raised when export is requested but the DB-cached ReconciliationSummary is missing."""
