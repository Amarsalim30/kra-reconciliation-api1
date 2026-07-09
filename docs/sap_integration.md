# SAP Business One Service Layer Integration

The SAP Business One (SBO) Integration module is responsible for authenticating with the SAP Service Layer, executing queries to fetch invoice data, mapping the results into standardized schemas, and handling connection and execution errors.

---

## 1. SAP Service Layer Client

The SBO client is implemented in `app/core/sap_client.py` as an asynchronous class wrapping `httpx.AsyncClient`.

### Client Lifecycle & Session management
* **Authentication**: The client logs in by posting credentials to the Service Layer's login endpoint. It retrieves a session cookie (`B1SESSION` and `ROUTEID`) which is used for all subsequent requests.
* **Keep-Alive**: To avoid session timeouts, the client pools connections and manages session lifecycle.
* **Logout**: When the lifecyle ends (or app shuts down), it executes a logout call to release resources on the SAP server.

### Configuration (`Settings`)
The client retrieves config values from the application settings:
* `SAP_BASE_URL`: Service Layer root URL (e.g., `https://sap-host:50000/b1s/v1`)
* `SAP_USERNAME`: B1 login user
* `SAP_PASSWORD`: Password
* `SAP_COMPANY_DB`: Database schema name

---

## 2. SQL Query Builders & Data Extraction

Instead of pulling full tables, this module interacts with SAP's **SQL Queries Service** (`/SQLQueries`) to execute parameterized queries. This ensures safety against SQL injection and minimizes memory usage.

### SQL Queries

#### A. Sales Invoices Query (A/R Invoices)
* **Source Table**: `OINV`
* **Query SQL**:
  ```sql
  SELECT DocEntry, DocNum, U_CUNumber, DocTotal, VatGroup, DocDate 
  FROM OINV 
  WHERE DocDate BETWEEN ? AND ?
  ```

#### B. Purchase Invoices Query (A/P Invoices)
* **Source Table**: `OPCH`
* **Query SQL**:
  ```sql
  SELECT DocEntry, DocNum, U_CUNumber, DocTotal, VatGroup, DocDate 
  FROM OPCH 
  WHERE DocDate BETWEEN ? AND ?
  ```

---

## 3. Data Schema (`SapInvoice`)

Results from SAP queries are parsed and mapped into the `SapInvoice` Pydantic model (`app/schemas/sap.py`):

```python
from decimal import Decimal
from datetime import date
from typing import Literal
from pydantic import BaseModel, Field

class SapInvoice(BaseModel):
    doc_entry: int = Field(description="Internal SAP Document Entry ID")
    invoice_number: str = Field(description="SAP Document Number (DocNum) as Invoice identifier")
    cu_number: str = Field(description="Fiscal CU Serial Number from custom field U_CUNumber")
    base_amount: Decimal = Field(description="Total document amount before VAT/reconciliation calculations")
    vat_group: str = Field(description="VAT Tax Group identifier (e.g., A16, Exempt)")
    invoice_date: date = Field(description="Invoice document date")
    doc_type: Literal["AR_INVOICE", "AP_INVOICE"] = Field(description="Sales (A/R) or Purchase (A/P) identifier")

    model_config = {
        "json_encoders": {
            Decimal: lambda v: float(v)
        }
    }
```

---

## 4. Error Mapping & Resiliency

To prevent SAP service failure from crashing the entire FastAPI backend, standard HTTP errors are mapped into domain exceptions in `app/core/exceptions.py`:

* **`SAPConnectionError`**: Triggered when the client fails to connect, times out, or receives HTTP 503/504 status.
* **`SAPQueryError`**: Triggered when the query execution fails on the SAP database side (e.g., incorrect syntax, missing fields, or unauthorized permissions).
* **`SAPSessionExpired`**: Handles B1SESSION cookie expiration, triggering an automatic login retry before throwing an exception.
