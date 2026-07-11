# Phase 5 – Reporting & Export (Final — Implementation Ready)

A dedicated **Reporting & Export layer** above the reconciliation engine.
No reconciliation logic changes. Clean package boundaries, no layer violations.

---

## Package Structure

```
app/
├── domain/
│   ├── reconciliation_status.py      ← ReconciliationStatus enum (moved from schemas)
│   └── reconciliation_constants.py   ← STATUS_ORDER, STATUS_PRIORITY, REMARK_MAP, versions
│
├── repositories/
│   ├── projections.py                ← ReconciliationProjection dataclass (repository layer type)
│   └── reconciliation_repository.py  ← get_projections(); imports from projections.py
│
├── services/
│   ├── reconciliation_service.py     ← engine (imports from domain only)
│   ├── summary_service.py            ← [NEW] build_summary() — shared across all callers
│   └── ...
│
└── reporting/
    ├── __init__.py
    ├── context.py               ← ExportContext (frozen; no company — read from session)
    ├── export_filename_builder.py ← ExportFilenameBuilder (ms-precision UTC timestamp)
    ├── artifact.py              ← ExportArtifact (frozen dataclass; generic output)
    ├── workbook_artifact.py     ← WorkbookArtifact (frozen dataclass)
    ├── export_row.py            ← ReconciliationExportRow (reporting DTO, not domain)
    ├── registry.py              ← ExportStrategyRegistry + create_default_registry()
    ├── exporter.py              ← dispatches via registry
    ├── errors.py                ← UnsupportedExportFormatError
    ├── strategies/
    │   ├── base.py              ← ExportStrategy ABC → ExportArtifact
    │   └── zip_strategy.py      ← ZipExporter
    ├── workbook_builder.py      ← pure formatter; returns list[WorkbookArtifact]
    ├── styles.py                ← HEADER_FILL, WARNING_FILL, cell formats
    ├── sheet_definitions.py     ← SheetDefinition registry + NEEDS_REVIEW_STATUSES
    └── zip_builder.py           ← assembles BytesIO ZIP from WorkbookArtifacts
```

---

## Architecture Flow

```
GET /api/v1/reconciliation/{session_id}/export?format=zip
            │
            ▼
exporter.build_export(session, db, context, format) → ExportArtifact
            │
            ├── 1. reconciliation_repository.get_projections(session_id, db)
            │         → list[ReconciliationProjection]  (frozen; mirrors DB columns)
            │         → ORDER BY (priority, cu, sap_inv, kra_inv) in DB
            │
            ├── 2. to_export_rows(projections)
            │         → list[ReconciliationExportRow]   (frozen; reporting type)
            │         → remark = REMARK_MAP[status]     (derived from current map)
            │
            ├── 3. summary_service.build_summary(rows, total_sap, total_kra)
            │         → ReconciliationSummary
            │
            ├── 4. strategy = registry.get(format)  → ExportStrategy
            │
            └── 5. strategy.export(rows, summary, context, session) → ExportArtifact
                        │
                        ├── workbook_builder.build_all(rows, summary, context)
                        │       → list[WorkbookArtifact]
                        │
                        ├── zip_builder.pack(artifacts + metadata)
                        │       → BytesIO
                        │
                        └── ExportArtifact(filename, media_type="application/zip", content)
```

---

## Key Design Decisions

### remark: derived, not versioned

`remark_version` is **dropped**. Storing it would require maintaining every historical
`REMARK_MAP` forever — a maintenance burden that isn't justified unless export wording is a
regulated historical artifact.

Decision: store only `status`. Derive `remark = REMARK_MAP[status]` at export time from the
**current** map. If wording must change in the future, it is treated as a deliberate migration
rather than a transparent background change — that is the appropriate handling.

The export schema version (`EXPORT_SCHEMA_VERSION`) still captures structural changes.

### ReconciliationProjection is retained

The dual conversion (`ORM → Projection → ExportRow`) adds a seam. It is kept because:
- The repository should not know the reporting layer exists.
- `ReconciliationExportRow` carries derived fields (`remark`) that have no place in a
  persistence projection.
- If the project ever moves to raw SQL, async queries, or a different ORM, the reporting
  layer is unaffected.

The tradeoff (extra boilerplate) is accepted in exchange for strict layer isolation.

### STATUS_PRIORITY starts at 1

```python
STATUS_PRIORITY = {s: i for i, s in enumerate(STATUS_ORDER, start=1)}
```

Priority `0` conventionally means "unspecified" in SQL `CASE` expressions and reporting
systems. Starting at `1` makes the intent unambiguous.

---

## Proposed Changes

### `app/domain/reconciliation_status.py` [NEW]

```python
from enum import Enum

class ReconciliationStatus(str, Enum):
    MATCH               = "Match"
    MISSING_IN_SAP      = "Missing in SAP"
    MISSING_IN_KRA      = "Missing in KRA"
    AMOUNT_MISMATCH     = "Amount Mismatch"
    VAT_MISMATCH        = "VAT Mismatch"
    DATE_MISMATCH       = "Date Mismatch"
    MULTIPLE_MISMATCHES = "Multiple Mismatches"
    DUPLICATE_CU        = "Duplicate CU"
```

`app/schemas/reconciliation.py` re-exports for backward compatibility — no changes
to existing API code required.

---

### `app/domain/reconciliation_constants.py` [NEW]

```python
from app.domain.reconciliation_status import ReconciliationStatus

# Single canonical ordering — priorities derived automatically, no magic integers.
STATUS_ORDER: tuple[ReconciliationStatus, ...] = (
    ReconciliationStatus.DUPLICATE_CU,
    ReconciliationStatus.MISSING_IN_SAP,
    ReconciliationStatus.MISSING_IN_KRA,
    ReconciliationStatus.MULTIPLE_MISMATCHES,
    ReconciliationStatus.AMOUNT_MISMATCH,
    ReconciliationStatus.VAT_MISMATCH,
    ReconciliationStatus.DATE_MISMATCH,
    ReconciliationStatus.MATCH,
)

# enumerate(start=1): 0 conventionally means "unspecified" in SQL CASE / reporting systems
STATUS_PRIORITY: dict[ReconciliationStatus, int] = {
    s: i for i, s in enumerate(STATUS_ORDER, start=1)
}

# Remark text. Change here = change everywhere (export, future email, future PDF).
# No versioning: treat wording changes as deliberate migrations.
REMARK_MAP: dict[ReconciliationStatus, str] = {
    ReconciliationStatus.MATCH:               "Match",
    ReconciliationStatus.AMOUNT_MISMATCH:     "Amount Mismatch",
    ReconciliationStatus.VAT_MISMATCH:        "VAT Mismatch",
    ReconciliationStatus.DATE_MISMATCH:       "Date Mismatch",
    ReconciliationStatus.MULTIPLE_MISMATCHES: "Multiple Mismatches",
    ReconciliationStatus.MISSING_IN_SAP:      "Missing in SAP",
    ReconciliationStatus.MISSING_IN_KRA:      "Missing in KRA",
    ReconciliationStatus.DUPLICATE_CU:        "Duplicate CU",
}

# Versioning policy (increment only for the documented reason — do not cross-increment):
#   STATUS_PRIORITY_VERSION  — increment ONLY when STATUS_ORDER changes (sort order changes)
#   EXPORT_SCHEMA_VERSION    — increment ONLY when workbook layout or Export.json structure changes
#   REMARK_MAP               — change wording freely; no version tracked (deliberate migration)
STATUS_PRIORITY_VERSION: str = "1"
EXPORT_SCHEMA_VERSION:   str = "1.0"

# Naming note: STATUS_ORDER communicates sequence; STATUS_SEVERITY_ORDER would better communicate
# *why* this order exists (severity: most-critical first). Either name is acceptable.
# Choose one and enforce it consistently across the codebase.
```

---

### `app/repositories/projections.py` [NEW]

`ReconciliationProjection` is defined here — in the repository layer — not in `reporting/`.
This keeps the type co-located with the code that produces it, and means the reporting layer
imports from `repositories.projections`, not from `repositories.reconciliation_repository`.

```python
@dataclass(frozen=True)
class ReconciliationProjection:
    cu_number:           str
    status:              ReconciliationStatus
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
```

---

### `app/repositories/reconciliation_repository.py` [NEW]
    {s.value: p for s, p in STATUS_PRIORITY.items()},
    value=SessionReconciliationResult.status,
    else_=len(STATUS_ORDER) + 1,   # unknown statuses sort last
)

def get_projections(session_id: str, db: Session) -> list[ReconciliationProjection]:
    """
    Ordered by (status_priority, cu_number, sap_invoice_number, kra_invoice_number).
    Explicit tie-breakers prevent non-deterministic ordering for duplicate CUs.
    """
    rows = (
        db.query(SessionReconciliationResult)
        .filter(SessionReconciliationResult.session_id == session_id)
        .order_by(
            _STATUS_ORDER_EXPR,
            SessionReconciliationResult.cu_number,
            SessionReconciliationResult.sap_invoice_number,
            SessionReconciliationResult.kra_invoice_number,
        )
        .all()
    )
    return [_to_projection(r) for r in rows]


def _to_projection(r: SessionReconciliationResult) -> ReconciliationProjection:
    # Explicit constructor — no reflection, compile-time field safety.
    # Fail-fast on invalid status: ReconciliationStatus(r.status) raises ValueError
    # if the DB contains an unrecognised status string. This is intentional — a corrupted
    # or migrated status aborts the export rather than silently producing wrong data.
    # The ValueError propagates to the endpoint and returns HTTP 500.
    return ReconciliationProjection(
        cu_number=r.cu_number,
        status=ReconciliationStatus(r.status),
        amount_match=r.amount_match,
        vat_match=r.vat_match,
        date_match=r.date_match,
        sap_invoice_number=r.sap_invoice_number,
        sap_partner_name=r.sap_partner_name,
        sap_pin=r.sap_pin,
        sap_invoice_date=r.sap_invoice_date,
        sap_base_amount=r.sap_base_amount,
        sap_vat_group=r.sap_vat_group,
        kra_invoice_number=r.kra_invoice_number,
        kra_partner_name=r.kra_partner_name,
        kra_pin=r.kra_pin,
        kra_invoice_date=r.kra_invoice_date,
        kra_base_amount=r.kra_base_amount,
        kra_vat_group=r.kra_vat_group,
    )
```

---

### `app/reporting/export_row.py` [NEW]

`ReconciliationExportRow` lives in `reporting/`, not `domain/` — it carries derived
presentation fields (`remark`) and belongs to the reporting layer.

```python
@dataclass(frozen=True)
class ReconciliationExportRow:
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
```

---

### `app/reporting/context.py` [NEW]

```python
@dataclass(frozen=True)
class ExportContext:
    generated_by:   str
    app_version:    str
    generated_at:   datetime    # timezone-aware (UTC); set once by router
    export_version: str = EXPORT_SCHEMA_VERSION
```

`generated_at` is always `datetime.now(timezone.utc)` — the type annotation and constructor
enforce awareness; naive datetimes are rejected.

`company` is read from `session.company_db` inside the strategy — not stored on context,
which holds only export-level metadata common to all sessions.

---

### `app/reporting/errors.py` [NEW]

```python
class UnsupportedExportFormatError(Exception):
    """Raised when no strategy is registered for the requested ExportFormat."""
```

---

### `app/reporting/registry.py` [NEW]

```python
class ExportStrategyRegistry:
    def __init__(self) -> None:
        self._strategies: dict[ExportFormat, ExportStrategy] = {}

    def register(self, fmt: ExportFormat, strategy: ExportStrategy) -> None:
        self._strategies[fmt] = strategy

    def get(self, fmt: ExportFormat) -> ExportStrategy:
        if fmt not in self._strategies:
            raise UnsupportedExportFormatError(
                f"No export strategy registered for format '{fmt.value}'. "
                f"Available: {[f.value for f in self._strategies]}"
            )
        return self._strategies[fmt]


def create_default_registry() -> ExportStrategyRegistry:
    """
    Factory — no module-level globals. Call once at application startup.

    Registered in the FastAPI lifespan event:
        @asynccontextmanager
        async def lifespan(app: FastAPI):
            app.state.export_registry = create_default_registry()
            yield

    The export endpoint retrieves it via:
        registry: ExportStrategyRegistry = request.app.state.export_registry

    This ensures a single registry instance per application process and makes
    DI / test overrides straightforward.
    """
    reg = ExportStrategyRegistry()
    reg.register(ExportFormat.ZIP, ZipExporter())
    return reg
```

---

### `app/reporting/artifact.py` [NEW]

```python
@dataclass(frozen=True)
class ExportArtifact:
    filename:   str       # full filename including timestamp and extension
    media_type: str       # "application/zip", "application/pdf", etc.
    content:    BytesIO   # seeked to 0
    # Note: frozen=True fixes the BytesIO *reference*, not the buffer contents.
    # BytesIO is inherently mutable. Do not write to content after construction.
```

The router unpacks directly:
```python
return StreamingResponse(
    artifact.content,
    media_type=artifact.media_type,
    headers={"Content-Disposition": f'attachment; filename="{artifact.filename}"'},
)
```

---

### `app/reporting/workbook_artifact.py` [NEW]

```python
@dataclass(frozen=True)
class WorkbookArtifact:
    zip_path:  str    # e.g. "Details/05 Amount Mismatches.xlsx"
    filename:  str    # e.g. "05 Amount Mismatches.xlsx"
    content:   bytes  # serialized openpyxl workbook bytes
```

---

### `app/reporting/export_filename_builder.py` [NEW]

Millisecond-precision UTC timestamp prevents filename collisions even under automated export:

```python
class ExportFilenameBuilder:
    def build(
        self,
        session: ReconciliationSession,
        context: ExportContext,
        fmt: ExportFormat = ExportFormat.ZIP,
    ) -> str:
        type_label = "Sales" if session.session_type == ReconciliationType.SALES else "Purchases"
        # %f gives microseconds (6 digits); truncate to 3 for milliseconds
        ts = context.generated_at.strftime("%Y%m%dT%H%M%S.") + \
             f"{context.generated_at.microsecond // 1000:03d}Z"
        return (
            f"{type_label}_Reconciliation"
            f"_{session.from_date}_to_{session.to_date}"
            f"_{ts}.{fmt.value}"
        )
```

Example: `Sales_Reconciliation_2026-03-01_to_2026-03-31_20260710T174700.382Z.zip`

---

### SHA-256 Definition

Canonical payload includes `schema_version` so the same business rows under a different
export structure produce a different hash:

```python
def _compute_sha256(rows: list[ReconciliationExportRow], schema_version: str) -> str:
    # Sort key matches DB ordering: (cu, sap_inv, kra_inv, status)
    # This ensures identical business data always produces the same hash regardless
    # of in-memory list order or future changes to STATUS_PRIORITY.
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
```

Stable across: re-exports, database restores, ZIP recompression, workbook metadata changes.

---

### Empty Result Set Behaviour

HTTP 200 always. Archive structure is **stable regardless of row count**:

```
Metadata/
    Export.json           ← row_count: 0
Summary/
    01 Summary.xlsx       ← all counts zero
Details/
    README.txt            ← self-describing metadata for empty exports
```

`README.txt` is generated by a dedicated template function — not string concatenation —
so formatting is centralized, testable, and easy to extend:

```python
def build_empty_export_readme(
    session: ReconciliationSession,
    context: ExportContext,
) -> str:
    """Returns the full README.txt content for an empty export archive."""
    return "\n".join([
        "KRA Reconciliation Export",
        "=========================",
        f"Session ID:          {session.id}",
        f"Generated At:        {context.generated_at.isoformat()}",
        f"Generated By:        {context.generated_by}",
        f"Company:             {session.company_db}",
        f"Session Type:        {session.session_type.value.title()}",
        f"Date Range:          {session.from_date} to {session.to_date}",
        f"Compared:            Yes ({session.compared_at.isoformat()})",
        "Result:              No reconciliation rows found for this date range.",
    ])
```

---

### `app/services/summary_service.py` [NEW]

```python
def build_summary(
    rows: list[ReconciliationExportRow],
    total_sap: int,
    total_kra: int,
) -> ReconciliationSummary:
    """Pure function. Shared by compare API, export, dashboard, and future callers."""
```

`reconciliation_service.py` delegates to `build_summary()` — one implementation everywhere.

---

### Database Migration (this phase)

New columns on `session_reconciliation_results`:

| Column | Type | Populated by |
|---|---|---|
| `sap_pin` | `VARCHAR(100) NULL` | `/compare` endpoint from `session_invoices` |
| `kra_pin` | `VARCHAR(100) NULL` | `/compare` endpoint from `session_invoices` |

`remark` and `remark_version` are **not added** — remark is derived at export time, never persisted.

---

### Minor Modifications

| File | Change |
|---|---|
| `app/domain/reconciliation_status.py` | [NEW] `ReconciliationStatus` moved from `app/schemas/` |
| `app/schemas/reconciliation.py` | Re-exports `ReconciliationStatus` for backward compatibility |
| `app/models/reconciliation_session.py` | Add `sap_pin`, `kra_pin` to `SessionReconciliationResult` |
| `app/api/v1/reconciliation.py` | Populate `sap_pin`, `kra_pin` at `/compare` time; add export endpoint |
| `app/services/reconciliation_service.py` | Import from `app.domain` only; use `build_summary()` |
| `pyproject.toml` | Add `openpyxl>=3.1` |

---

### Frontend

#### [NEW] `frontend/src/features/sales/api/exportApi.ts`
Fetches ZIP as `Blob`, creates `<a>`, triggers download, revokes URL. Throws on non-2xx.

#### [MODIFY] `frontend/src/features/sales/components/ReconciliationWorkspace.tsx`
**Export ZIP** button — visible after `is_compared`, spinner while in-flight, error toast.
Works for Sales and Purchases (parameterised by `ReconciliationType`).

---

## Verification Plan

### `tests/test_export.py` [NEW]

| Test | Assertion |
|---|---|
| `test_export_returns_zip` | `Content-Type: application/zip`, non-empty body |
| `test_export_zip_structure_normal` | All 3 dirs + 12 paths present |
| `test_export_zip_structure_empty` | HTTP 200; `Details/README.txt` present; `row_count: 0` in JSON |
| `test_export_readme_contains_session_metadata` | README.txt contains Session ID, Date Range, Company |
| `test_export_metadata_json_fields` | `schema_version`, `status_priority_version`, `status_counts` present |
| `test_export_sha256_includes_schema_version` | Hash changes when `schema_version` changes, same rows |
| `test_export_sha256_over_canonical_json` | Same rows different insertion order → same hash |
| `test_export_sha256_changes_on_amount_change` | Mutate `sap_base_amount` → hash differs |
| `test_export_remark_derived_from_current_map` | Remark in workbook matches `REMARK_MAP[status]` |
| `test_export_summary_counts_match_build_summary` | Counts equal `summary_service.build_summary()` |
| `test_export_needs_review_excludes_matches` | No MATCH rows in `02 Needs Review.xlsx` |
| `test_export_ordering_deterministic` | Two identical result sets → same row order |
| `test_export_ordering_tie_breaker` | Identical CU, different invoice numbers → stable order |
| `test_export_mismatch_side_by_side_columns` | SAP Amount + KRA Amount both present |
| `test_export_matches_compact_columns` | No duplicated SAP/KRA columns |
| `test_export_table_names_are_safe` | All `displayName` values match `tbl_*` |
| `test_export_cu_as_text_format` | CU cells formatted `@` |
| `test_export_amount_format` | Amount cells use `#,##0.00` |
| `test_export_filename_is_timestamped_with_ms` | Filename contains millisecond timestamp pattern |
| `test_export_registry_raises_for_unknown_format` | `UnsupportedExportFormatError` raised |
| `test_export_requires_auth` | 401 without token |
| `test_export_requires_compared_session` | 400 before `/compare` |
| `test_export_unicode_partner_names` | Müller, شركة السلام, 北京贸易有限公司 survive into Excel |
| `test_export_negative_amounts` | Credit notes with negative `base_amount` export correctly |
| `test_export_null_optional_fields` | NULL partner/invoice → empty string, no exception |
| `test_export_unknown_status_fails_fast` | Insert invalid status string into DB; export returns 500; no corrupted workbook produced |
| `test_export_large_dataset_correctness` | 5 000 rows → ZIP completes, row count preserved |

### Manual Verification

1. Run a full Sales reconciliation in the browser.
2. Click **Export ZIP** — millisecond-timestamped filename, downloads without error.
3. Click **Export ZIP** again — second filename has a different timestamp; no overwrite.
4. Unzip — `Metadata/` first, then `Summary/`, then `Details/` (stable layout every time).
5. Open `Metadata/Export.json` — `schema_version`, `status_counts`, sha256 all present.
6. Open `Summary/01 Summary.xlsx` — Metadata sheet `generated_at` matches JSON.
7. Open `Details/02 Needs Review.xlsx` — DUPLICATE_CU rows first; Excel Table active.
8. Open `Details/05 Amount Mismatches.xlsx` — side-by-side columns, red KRA cells, CU as text.
9. Open `Details/04 Matches.xlsx` — compact layout, Remark = "Match".
10. Run an empty date range comparison → export ZIP; `Details/README.txt` contains session metadata.
11. Repeat for Purchases workspace.
