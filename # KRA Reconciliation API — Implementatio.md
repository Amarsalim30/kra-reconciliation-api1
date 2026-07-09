# KRA Reconciliation API — Implementation Plan

## Goal
Build a FastAPI backend for single-company, on-demand KRA iTax vs SAP B1 invoice reconciliation (Sales + Purchases) with JWT auth, in-memory session store, and Service Layer SQL Query integration.

---

## Architecture Summary

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  FastAPI API     │────▶│  SAP B1         │
│   (React/Vue)   │     │  /api/v1/*       │     │  Service Layer  │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
             ┌──────────┐ ┌──────────┐ ┌──────────┐
             │ PostgreSQL│ │ In-Memory │ │  Redis   │
             │ (Users,   │ │ Session   │ │ (Refresh │
             │  Tokens)  │ │ Store     │ │  Block)  │
             └──────────┘ └──────────┘ └──────────┘
```

---

## Phase 1 — Foundation (Week 1)

### 1.1 Project Structure & Config
- [ ] Create `app/` package structure:
  ```
  app/
  ├── api/
  │   ├── v1/
  │   │   ├── auth.py
  │   │   ├── sales.py
  │   │   ├── purchases.py
  │   │   └── router.py
  │   └── deps.py
  ├── core/
  │   ├── config.py        # (exists)
  │   ├── security.py      # JWT, bcrypt
  │   ├── database.py      # SQLAlchemy 2.0 async engine
  │   └── sap_client.py    # httpx Service Layer client
  ├── models/
  │   ├── user.py
  │   ├── refresh_token.py
  │   └── audit_log.py
  ├── schemas/
  │   ├── auth.py
  │   ├── sap.py
  │   ├── kra.py
  │   ├── session.py
  │   └── result.py
  ├── services/
  │   ├── auth_service.py
  │   ├── sap_service.py
  │   ├── kra_service.py
  │   ├── session_store.py
  │   └── reconciliation_engine.py
  ├── main.py
  └── alembic/
  ```
- [ ] Add `pyproject.toml` / `requirements.txt` sync
- [ ] Configure `alembic.ini` with SQLAlchemy 2.0 async

### 1.2 Database & Auth Models
- [ ] `User` model: id, email, hashed_password, role ("checker"), is_active, created_at
- [ ] `RefreshToken` model: token_hash, user_id, expires_at, revoked_at
- [ ] `AuditLog` model (optional): user_id, action, timestamp, meta_json
- [ ] Alembic migration `0001_initial_schema.py`

### 1.3 Security Utilities
- [ ] `create_access_token(data, expires_delta)` — JWT HS256
- [ ] `create_refresh_token()` — random opaque token, store hash
- [ ] `verify_password` / `get_password_hash` — bcrypt
- [ ] `get_current_user` dependency — validates access token, returns User
- [ ] Refresh token rotation: on `/refresh`, revoke old, issue new

### 1.4 Auth Endpoints
- [ ] `POST /api/v1/auth/login` — email/password → access + refresh token
- [ ] `POST /api/v1/auth/refresh` — refresh token → new access token
- [ ] `POST /api/v1/auth/logout` — revoke refresh token

---

## Phase 2 — SAP Integration (Week 1–2)

### 2.1 SAP Service Layer Client
- [ ] `SAPClient` class wrapping `httpx.AsyncClient`
  - `login()` → session ID cookie
  - `execute_sql_query(sql, params)` → parameterized SQL Query API
  - `logout()` → cleanup
  - Connection pooling, timeout, retry logic
- [ ] Config via `Settings`: base_url, username, password, company_db

### 2.2 SAP Query Builders
- [ ] Sales query: `SELECT DocEntry, DocNum, U_CUNumber, DocTotal, VatGroup, DocDate FROM OINV WHERE DocDate BETWEEN ? AND ?`
- [ ] Purchases query: `SELECT DocEntry, DocNum, U_CUNumber, DocTotal, VatGroup, DocDate FROM OPCH WHERE DocDate BETWEEN ? AND ?`
- [ ] Parameterized to prevent injection
- [ ] Map result rows → `SapInvoice` Pydantic model

### 2.3 SAP Service
- [ ] `load_sales_invoices(from_date, to_date)` → `list[SapInvoice]`
- [ ] `load_purchase_invoices(from_date, to_date)` → `list[SapInvoice]`
- [ ] Error handling: map SAP HTTP errors → custom exceptions

---

## Phase 3 — KRA CSV & Session Store (Week 2)

### 3.1 KRA Template & Parser
- [ ] `GET /sales/template` and `GET /purchases/template` → CSV with headers:
  `Invoice Number,CU Number,Base Amount,VAT Group,Invoice Date`
- [ ] CSV parser using `csv.DictReader` + Pydantic validation
  - Validate: required fields, Decimal amounts, YYYY-MM-DD dates
  - Reject duplicate Invoice Numbers in same upload
- [ ] Return `list[KraInvoice]` (5 fields)

### 3.2 In-Memory Session Store
- [ ] `SessionStore` class (singleton, async-safe with `asyncio.Lock`)
  - `create_session(user_id, workflow_type, sap_data, date_from, date_to)` → `session_id`
  - `get_session(session_id)` → `SessionData` or None
  - `update_kra_data(session_id, kra_data)` → updated session
  - `delete_session(session_id)`
  - Background cleanup task: every 5 min, remove sessions > 30 min idle
- [ ] `SessionData` Pydantic model:
  ```python
  session_id: UUID
  user_id: int
  workflow_type: Literal["sales", "purchases"]
  sap_data: list[SapInvoice]
  kra_data: list[KraInvoice] | None
  date_from: date
  date_to: date
  created_at: datetime
  last_accessed: datetime
  ```

### 3.3 Session Endpoints (Sales & Purchases)
- [ ] `GET /load?from=...&to=...` → fetch SAP, create session, return `{session_id, sap_preview}`
  - `sap_preview`: first 50 rows, all 7 fields
- [ ] `POST /import-kra` (multipart: session_id + file) → validate CSV, store in session, return `{session_id, kra_preview}`
  - `kra_preview`: first 50 rows, all 5 fields
- [ ] `POST /compare` (json: `{session_id}`) → retrieve session, run reconciliation, return results, delete session

---

## Phase 4 — Reconciliation Engine (Week 2–3)

### 4.1 Matching Algorithm
- [ ] `reconcile(sap: list[SapInvoice], kra: list[KraInvoice])` → `list[ReconciliationResult]`
- [ ] Build dicts keyed by `invoice_number` for O(n) matching
- [ ] Compare 5 fields exactly (Decimal comparison, date equality)
- [ ] Generate remark strings:
  - Matched: `"All fields match"`
  - Mismatch: `"CU Number differs (SAP: X, KRA: Y); Base Amount differs (SAP: 1000, KRA: 1050)"`
  - SAP Only: `"Invoice exists in SAP but not in KRA"`
  - KRA Only: `"Invoice exists in KRA but not in SAP"`

### 4.2 Result Schemas
- [ ] `ReconciliationResult`: invoice_number, remark, status (Enum)
- [ ] `CompareResponse`: results: list[ReconciliationResult], summary: {matched, mismatched, sap_only, kra_only}

### 4.3 Performance
- [ ] Test with 10k invoices < 2s
- [ ] Memory: ~50MB for 10k records per session

---

## Phase 5 — API Assembly & Polish (Week 3)

### 5.1 Router Composition
- [ ] `app/api/v1/router.py` combines auth, sales, purchases routers
- [ ] Prefix `/api/v1`, tags `["auth", "sales", "purchases"]`

### 5.2 Main App
- [ ] `app/main.py`: FastAPI instance, CORS, exception handlers, lifespan (startup/shutdown)
- [ ] Startup: init DB pool, SAP client, session store cleanup task
- [ ] Shutdown: close pools, stop cleanup task

### 5.3 Exception Handling
- [ ] Custom exceptions: `SAPConnectionError`, `SAPQueryError`, `SessionNotFound`, `SessionExpired`, `CSVValidationError`
- [ ] Global handler → JSON `{detail, code}`

### 5.4 OpenAPI / Docs
- [ ] Configure title, version, description
- [ ] Tag descriptions
- [ ] Example responses

---

## Phase 6 — Tests & CI (Week 3–4)

### 6.1 Unit Tests
- [ ] Auth: login, refresh, logout, token expiry
- [ ] SAP query builder: parameter binding, SQL generation
- [ ] KRA parser: valid CSV, invalid rows, duplicates, wrong headers
- [ ] Reconciliation engine: all 4 match cases, field-level diffs

### 6.2 Integration Tests
- [ ] Auth flow with TestClient
- [ ] Session lifecycle: load → import → compare → clear
- [ ] Sales + Purchases independence

### 6.3 CI Pipeline (GitHub Actions)
- [ ] Lint: ruff, mypy
- [ ] Test: pytest with PostgreSQL testcontainers
- [ ] Build: Docker image

---

## Data Models Reference

### Pydantic Schemas (app/schemas/)

```python
# auth.py
TokenResponse(access_token: str, refresh_token: str, token_type: str)
RefreshRequest(refresh_token: str)
LoginRequest(email: str, password: str)

# sap.py
SapInvoice(doc_entry: int, invoice_number: str, cu_number: str,
           base_amount: Decimal, vat_group: str, invoice_date: date,
           doc_type: Literal["AR_INVOICE", "AP_INVOICE"])
SapInvoicePreview = SapInvoice  # same fields for preview

# kra.py
KraInvoice(invoice_number: str, cu_number: str, base_amount: Decimal,
           vat_group: str, invoice_date: date)
KraInvoicePreview = KraInvoice

# session.py
LoadRequest(date_from: date, date_to: date)
LoadResponse(session_id: UUID, sap_preview: list[SapInvoicePreview])
ImportKRAResponse(session_id: UUID, kra_preview: list[KraInvoicePreview])
CompareRequest(session_id: UUID)
CompareResponse(results: list[ReconciliationResult], summary: Summary)

# result.py
class Status(str, Enum):
    MATCHED = "Matched"
    MISMATCH = "Mismatch"
    SAP_ONLY = "SAP Only"
    KRA_ONLY = "KRA Only"

ReconciliationResult(invoice_number: str, remark: str, status: Status)
Summary(matched: int, mismatched: int, sap_only: int, kra_only: int)
```

---

## Configuration Checklist (.env)

```bash
DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/kra_recon
SECRET_KEY=change-me-32-chars-min
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

SAP_BASE_URL=https://sap-host:50000/b1s/v1
SAP_USERNAME=B1USER
SAP_PASSWORD=secret
SAP_COMPANY_DB=SBODEMO

SESSION_TTL_MINUTES=30
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| SAP Service Layer schema varies per customer | Make SQL queries configurable via `.env` or DB table |
| Large CSV uploads (>50MB) | Stream parsing, chunked processing, file size limit |
| Session memory pressure | Limit concurrent sessions, TTL cleanup, optional Redis |
| Decimal precision mismatch | Use `Decimal` throughout, quantize to 2dp for compare |
| SAP downtime | Circuit breaker, graceful degradation, clear error messages |

---

## Out of Scope (v1)

- Multi-company / multi-tenant
- Admin user management UI
- Scheduled/automated reconciliation
- KRA API integration (TIMS, iTax)
- Persistent reconciliation history
- Export to Excel/PDF (frontend concern)
- Advanced matching (fuzzy, date windows, amount tolerance)
- WebSocket progress updates

---

## Acceptance Criteria

1. **Auth**: Login returns JWT, refresh works, logout revokes refresh token
2. **Sales Load**: Date range → SAP query → session created → preview returned
3. **KRA Import**: Template downloads, valid CSV imports → preview, invalid CSV rejected
4. **Compare**: Matched/Mismatch/SAP Only/KRA Only correctly identified with remarks
5. **Purchases**: Independent flow, same behavior
6. **Session**: Expires after 30 min idle, cleared after compare
7. **Tests**: >80% coverage on services/engine, integration tests pass

# Clarification
KRA imports will use a standardized CSV template provided by the application. Files not matching the required structure will be rejected with clear validation errors
✅ Fixed CSV template.
✅ Separate "Load" step.
✅ Redis-backed session (not in-memory).
✅ Session deleted immediately after a successful comparison.
✅ 30-minute session timeout.
✅ Any date-range change requires a new Load operation.