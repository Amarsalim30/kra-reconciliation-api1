# Credit Note and Debit Note Reconciliation Plan (Final Approved Version)

## Goal
Evolve the reconciliation data ingestion pipeline to support A/R and A/P Credit Notes and Debit Notes without modifying the core matching logic. This is achieved by building a Document Ingestion and Transformation Layer that aggregates document lines by normalized VAT Group, standardizes their signs ($+\text{abs}(\text{LineTotal})$ for Invoices and Debit Memos, $-\text{abs}(\text{LineTotal})$ for Credit Notes), and emits canonical reconciliation rows.

---

## Reconciliation Population Contract

> [!IMPORTANT]
> **Governing Rule:** Only documents that legally contribute to the KRA tax declaration may enter the normalization pipeline. Documents excluded from the KRA declaration for the current deployment (for example drafts, quotations, deliveries, and cancelled invoices) must not enter the normalization pipeline.
> 
> The population filter represents deployment-specific business rules. Different SAP Business One or eTIMS integrations may require different inclusion policies without affecting the reconciliation engine.

---

## Canonical Reconciliation Row Schema

The boundary between ingestion and comparison is defined by the following canonical structure, which represents the reconciliation contract. Canonical rows are value objects; they must never be modified after creation.

```python
@dataclass(frozen=True)
class CanonicalReconciliationRow:
    cu_number: str                       # Composite match key part
    vat_group: str                       # Composite match key part
    base_amount: Decimal                 # Numeric comparison value
    invoice_number: str                  # Informational metadata
    invoice_date: date                   # Informational metadata
    pin: str                             # Informational metadata
    partner_name: str                    # Informational metadata
    provenance: IngestionProvenance      # Audit metadata (in-memory)
```

---

## Reconciliation Engine Contract

The comparison engine's boundary is strictly defined as follows:
- **Accepts Only:** Sequences of `CanonicalReconciliationRow` instances.
- **Zero Semantics:** The engine has no knowledge of SAP document types, Credit Notes, Debit Notes, Cancellation Documents, Service Layer endpoints, SQL views, `ObjectType`, or `CancelStatus`.

---

## Proposed Architecture (Simplified Ingestion Pipeline)

```
       Invoices Endpoint                    CreditNotes Endpoint
    (/Invoices or /PurchaseInvoices)      (/CreditNotes or /PurchaseCreditNotes)
              │                                      │
              ▼                                      ▼
      [Population Filter]                    [Population Filter]
  (Apply Ingestion Policy)                 (Apply Ingestion Policy)
              │                                      │
              ▼                                      ▼
    [VAT Group Aggregation]                [VAT Group Aggregation]
              │                                      │
              ▼                                      ▼
      [ +abs(LineTotal) ]                    [ -abs(LineTotal) ]
              │                                      │
              └───────────────────┬──────────────────┘
                                  ▼
                     [CanonicalReconciliationRow]
                                  │
                                  ▼
                         [Comparison Engine]
```

---

## SAP Document Discovery & Endpoints

To fetch the required documents from the SAP Service Layer for the date range:

1. **Invoices Endpoint:**
   - **Sales:** `/b1s/v1/Invoices`
   - **Purchases:** `/b1s/v1/PurchaseInvoices`
   - **Details:** Includes both standard invoices and debit memos. Since both are reconciled as positive taxable transactions, they follow the same normalization path.
2. **Credit Notes Endpoint:**
   - **Sales:** `/b1s/v1/CreditNotes`
   - **Purchases:** `/b1s/v1/PurchaseCreditNotes`

---

## Ingestion & Transformation Rules

### 1. Invoices Endpoint Transformation
1. **Fetch:** Query `/Invoices` (or `/PurchaseInvoices`) for the date range.
2. **Filter:** Apply Population Filter according to the configured ingestion policy. (The default policy for this deployment happens to exclude documents where `Cancelled == "tYES"`, as well as `'Draft'` or `'Planned'` statuses).
3. **Aggregate:** Aggregate all document lines sharing the same normalized VAT Group into a single taxable base amount before sign normalization.
4. **Normalize Sign:** Set $\text{normalized\_base\_amount} = +\text{abs}(\text{aggregated\_base\_amount})$ for each group.
5. **Emit:** Yield the positive `CanonicalReconciliationRow` with attached provenance.

### 2. Credit Notes Endpoint Transformation
1. **Fetch:** Query `/CreditNotes` (or `/PurchaseCreditNotes`) for the date range.
2. **Filter:** Apply Population Filter according to the configured ingestion policy (e.g., skip `'Draft'` or `'Planned'`).
3. **Aggregate:** Aggregate all document lines sharing the same normalized VAT Group into a single taxable base amount before sign normalization.
4. **Normalize Sign:** Set $\text{normalized\_base\_amount} = -\text{abs}(\text{aggregated\_base\_amount})$ for each group.
5. **Emit:** Yield the negative `CanonicalReconciliationRow` with attached provenance.

### 3. Error Handling
Abort the reconciliation session and raise a descriptive integration exception if mandatory fields required by the canonical schema are missing or invalid, preventing calculation corruption.

---

## In-Memory Provenance & Auditing

Provenance is attached to each normalized row in-memory during the session (postponing DB schema updates):

```python
@dataclass(frozen=True)
class IngestionProvenance:
    session_source: str | None           # e.g., "SAP Sales" / "SAP Purchases"
    source_endpoint: str | None          # e.g., "Invoices", "CreditNotes"
    source_table: str | None             # e.g., "OINV", "ORIN"
    sap_object_type: str | None          # e.g., "13", "14"
    document_kind: str                   # e.g., "Invoice", "CreditNote"
    doc_entry: int | None
    doc_num: str | None
    base_doc_entry: int | None
    base_doc_num: str | None
    doc_object_code: str | None          # Raw SAP DocObjectCode
    raw_amount: Decimal                  # Original aggregated base amount before mapping
    normalized_amount: Decimal           # Final normalized amount
```

---

## Normalization Invariants

1. **Invariant 1 (Identity Integrity):** Normalization never changes identification attributes: `PIN`, `CU Number`, `Tax Date`, `VAT Group`, `Invoice Number`, `Customer Name`, or `Reference Document` fields.
2. **Invariant 2 (Scope of Mutation):** Normalization only changes the amount sign and provenance metadata.
3. **Invariant 3 (Cardinality):** Each eligible SAP document produces one or more canonical rows.
4. **Invariant 4 (Isolation):** Canonical rows are never merged or collapsed, even if they share the same CU and VAT Group.
5. **Invariant 5 (Immutability):** Canonical rows are immutable value objects once emitted from the normalization layer.
6. **Invariant 6 (Determinism):** Given identical SAP input, the normalization layer shall always produce identical canonical reconciliation rows regardless of paging order, execution time, or processing sequence.

---

## Verification Plan

### Automated Tests
- **Reconciliation Engine Invariance:** Assert that existing tests run successfully.
- **Endpoint Transformation Tests:**
  - Verify documents from Invoices endpoints map to positive amounts ($+\text{abs}(\dots)$).
  - Verify documents from Credit Notes endpoints map to negative amounts ($-\text{abs}(\dots)$).
- **Debit Memo Equivalence Test:** Verify that Debit Memos retrieved from `/Invoices` (distinguished by SubType metadata) reconcile identically to standard invoices.
- **Multiple VAT Groups:** Verify that a single SAP document with multiple VAT groups emits exactly one canonical row per normalized VAT group, each with the correct sign.
- **Absolute Value Tests:** Assert that credit notes with positive raw amounts map to negative, and those with negative raw amounts map to negative.
- **Fail-Fast Error Handling:** Verify that missing mandatory properties abort the session.
- **Identity Preservation:** Assert that PIN, Partner Name, VAT Group, DocDate, and CU Number are fully preserved.

### Manual Verification
1. Perform controlled postings (Invoices, Credit Notes, Debit Memos) in the SAP B1 sandbox.
2. Confirm the 13 attributes of the verification checklist against the KRA CSV.
3. **Total Sum Verification:** When both datasets represent the same reporting period and complete declaration population, verify that:
   - $\text{Total SAP taxable amount} == \text{Total KRA taxable amount}$
   - $\text{Total SAP VAT amount} == \text{Total KRA VAT amount}$
4. **Independent Record Count Balancing Checks:**
   - **SAP Population:**
     $$\text{SAP Canonical Rows} = \text{Matched} + \text{Missing in KRA} + \text{Needs Review} + \text{Filtered SAP Rows}$$
   - **KRA Population:**
     $$\text{KRA Canonical Rows} = \text{Matched} + \text{Missing in SAP} + \text{Needs Review}$$
5. Run the reconciliation session and verify that the export workbook and UI display the correct signs and matching status.

---

## Future Extensibility
Future document types (Returns, Cancellation Documents, Adjustment Documents, Reverse Charge Transactions, etc.) shall be introduced by extending the ingestion pipeline. No changes to the reconciliation engine shall be required.
