# KRA CSV Parsing & Redis Session Store

This module coordinates CSV imports for KRA iTax data, validates data types and duplicates, and manages short-lived matching sessions in Redis.

---

## 1. KRA CSV Templates & Parsing

The application provides standardized templates for users to upload their KRA iTax data. 

### CSV Structure & Headers
Both Sales and Purchases uploads expect a CSV file with the following headers:
`Invoice Number,CU Number,Base Amount,VAT Group,Invoice Date`

* **Invoice Number**: Plain string identifier (unique within the upload).
* **CU Number**: Control Unit fiscal invoice serial number.
* **Base Amount**: Numeric amount (parsed as a Python `Decimal` to preserve monetary precision).
* **VAT Group**: Standard tax code representing VAT tier (e.g. `A16` or `Exempt`).
* **Invoice Date**: Formatted date (parsed using `YYYY-MM-DD`).

### CSV Parser Logic (`app/services/kra_service.py`)
1. Reads the file as UTF-8.
2. Uses `csv.DictReader` to convert rows into dictionary inputs.
3. Validates structure using the `KraInvoice` Pydantic schema:
   * **Decimal Validation**: Sanitizes currency symbols or commas before parsing.
   * **Date Validation**: Ensures exact YYYY-MM-DD formatting.
   * **Duplicate Prevention**: Keeps track of seen invoice numbers inside the uploaded file and rejects the entire upload if a duplicate is found (raising a `CSVValidationError`).

---

## 2. Redis-Backed Session Store

The application uses Redis to persist active reconciliation workspaces, avoiding excessive memory usage on the main server process and enabling horizontal scaling.

### Session Lifecycle
1. **Load SAP Invoices**: Fetching invoices from SAP creates a session in Redis and returns a session ID to the client.
2. **Upload KRA CSV**: The client uploads the KRA CSV by referencing the session ID, which adds KRA data to the session.
3. **Compare & Clean**: The client triggers the comparison using the session ID. Once the comparison completes successfully, the session is **immediately deleted** from Redis to conserve memory.
4. **Timeout**: Any session that remains inactive or uncompared is automatically purged by Redis after **30 minutes** (configured via `SESSION_TTL_MINUTES`).

### Session Schema (`SessionData`)
Parsed data is serialized to JSON and stored in Redis using the following Pydantic schema structure:

```python
from uuid import UUID
from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel
from app.schemas.sap import SapInvoice
from app.schemas.kra import KraInvoice

class SessionData(BaseModel):
    session_id: UUID
    user_id: int
    workflow_type: Literal["sales", "purchases"]
    sap_data: list[SapInvoice]
    kra_data: list[KraInvoice] | None = None
    date_from: date
    date_to: date
    created_at: datetime
    last_accessed: datetime
```

---

## 3. Session API Flow

```
   [ Client ]               [ Backend API ]            [ SAP SL / Redis ]
       │                           │                           │
       ├─ GET /v1/sales/load ─────▶│                           │
       │  (date range)             ├─ Fetch SAP Invoices ─────▶│ (SAP SL)
       │                           │◀─ Return SapInvoice[] ────┤
       │                           │                           │
       │                           ├─ Create Session ─────────▶│ (Redis)
       │                           │◀─ Return Session ID ──────┤
       │◀─ Return load response ───┤                           │
       │                           │                           │
       ├─ POST /v1/sales/import ──▶│                           │
       │  (session_id + CSV file)  ├─ Parse & Validate CSV     │
       │                           ├─ Append KRA to session ──▶│ (Redis)
       │◀─ Return import response ─┤                           │
       │                           │                           │
       ├─ POST /v1/sales/compare ─▶│                           │
       │  (session_id)             ├─ Retrieve Session ───────▶│ (Redis)
       │                           │◀─ Return SessionData ─────┤
       │                           │                           │
       │                           ├─ Reconcile & Match        │
       │                           ├─ Delete Session ─────────▶│ (Redis)
       │◀─ Return match results ───┤                           │
```

### Route Designations

#### A. Data Loading
* `GET /api/v1/sales/load?from=YYYY-MM-DD&to=YYYY-MM-DD`
* `GET /api/v1/purchases/load?from=YYYY-MM-DD&to=YYYY-MM-DD`
* *Behavior*: Pulls SAP invoices, initializes a Redis session, and returns a JSON response containing the `session_id` and a preview of the first 50 SAP invoices.

#### B. CSV Upload
* `POST /api/v1/sales/import-kra` (Multipart Form: `session_id` + `file`)
* `POST /api/v1/purchases/import-kra` (Multipart Form: `session_id` + `file`)
* *Behavior*: Validates the CSV layout and appends it to the active session. Returns a preview of the first 50 KRA records.

#### C. Reconciliation
* `POST /api/v1/sales/compare` (JSON: `{"session_id": "..."}`)
* `POST /api/v1/purchases/compare` (JSON: `{"session_id": "..."}`)
* *Behavior*: Retrieves both SAP and KRA datasets, executes the matching algorithm, returns the output, and terminates the Redis session.
