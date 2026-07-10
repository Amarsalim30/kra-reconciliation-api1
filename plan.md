# SAP Sales Integration Plan (Replace Mock Sales Data)

## Objective

Replace the existing mock Sales dataset with live SAP Business One Sales Invoice data while keeping the reconciliation engine and UI unchanged.

The frontend and reconciliation engine should continue operating on the existing **7-column reconciliation model**, regardless of the complexity of the SAP response.

---

# Current State

Current flow:

```
Mock Sales Data
        ↓
Normalization
        ↓
Reconciliation Engine
        ↓
Comparison with KRA CSV
```

Target flow:

```
SAP Business One Service Layer
        ↓
Authentication
        ↓
GET /Invoices
        ↓
Extract Required Fields
        ↓
Flatten Invoice Lines
        ↓
Normalized Sales Dataset
        ↓
Reconciliation Engine
        ↓
Comparison with KRA CSV
```

---

# SAP Endpoints

## Login

```
POST https://b1su0206.cloudtaktiks.com:50000/b1s/v1/Login
```

Body

```json
{
    "CompanyDB": "CT_TECHBIZ_TESTII",
    "UserName": "cloudtaktiks\\CTC100038.4",
    "Password": "********"
}
```

The Service Layer returns a session cookie which must be reused for all subsequent requests.
{
    "odata.metadata": "https://b1su0206.cloudtaktiks.com:50000/b1s/v1/$metadata#B1Sessions/@Element",
    "SessionId": "321f30f4-7c74-11f1-c000-000d3a2e3049-139989234022016-8232",
    "Version": "1000220",
    "SessionTimeout": 30
}

---

## Sales Invoices

```
GET /b1s/v1/Invoices
```

Do **not** expose SAP credentials to the frontend.

The backend is solely responsible for:

- Authentication
- Session management
- Token renewal
- Fetching invoices
- Transforming SAP data

---

# Important Design Principle

The reconciliation engine **must never consume raw SAP invoices.**

SAP returns hundreds of fields intended for ERP functionality.

The reconciliation engine should only receive a normalized dataset containing the required reconciliation fields.

---

# Required Reconciliation Schema

Every record entering the reconciliation engine must have exactly the following fields.

| Reconciliation Column | SAP Source |
|-----------------------|-----------|
| PIN Number | `FederalTaxID` |
| Customer Name | `CardName` |
| Invoice Number | `DocNum` |
| Invoice Date | `DocDate` |
| CU Number | `U_CUINV` |
| VAT Group | `DocumentLines[].VatGroup` |
| Base Amount | `DocumentLines[].LineTotal` |

No additional SAP fields should reach the comparison layer.

---

# Why Base Amount Uses LineTotal

The KRA Sales CSV stores the taxable base amount, **not** the invoice total.

Example:

```
SAP

Line Total : 442,400
VAT        : 70,784
Doc Total  : 513,184
```

KRA

```
Base Amount = 442,400
```

Therefore:

```
Base Amount ← DocumentLines.LineTotal
```

NOT

```
Base Amount ← DocTotal
```

Using `DocTotal` would incorrectly include VAT and produce false mismatches.

---

# Invoice Flattening

## Problem

A single SAP invoice may contain multiple document lines.

Example

```
Invoice 764

Line 1
VAT Group O1
Base Amount 172,005.12

Line 2
VAT Group O1
Base Amount 267,563.52

Line 3
VAT Group O1
Base Amount 442,400.00
```

Meanwhile the KRA CSV is line-based.

Comparing one SAP invoice against multiple KRA rows would produce inaccurate results.

---

# Solution

Flatten every SAP invoice into individual reconciliation rows.

Input

```
Invoice
    ├── Header
    └── DocumentLines[]
```

Output

| PIN | Customer | Invoice | Date | CU Number | VAT Group | Base Amount |
|-----|----------|----------|------|-----------|-----------|------------:|
| P000609554G | Welding Alloys Ltd | 764 | 2024-01-08 | 0190439340000000134 | O1 | 172005.12 |
| P000609554G | Welding Alloys Ltd | 764 | 2024-01-08 | 0190439340000000134 | O1 | 267563.52 |
| P000609554G | Welding Alloys Ltd | 764 | 2024-01-08 | 0190439340000000134 | O1 | 442400.00 |

Each document line becomes one reconciliation record.

---

# Normalization Layer

Create a dedicated normalization service.

```
SAP Response
      ↓
SalesNormalizer
      ↓
NormalizedSalesRecord[]
```

The reconciliation engine should never know anything about SAP-specific field names.

---

# Normalized Model

```text
SalesRecord

pinNumber
customerName
invoiceNumber
invoiceDate
cuNumber
vatGroup
baseAmount
```

This model becomes the contract between SAP and the reconciliation engine.

---

# Backend Responsibilities

The backend should:

- Authenticate with SAP Service Layer.
- Maintain SAP session cookies.
- Fetch invoices.
- Iterate through every invoice.
- Iterate through every `DocumentLine`.
- Create one normalized record per document line.
- Return only normalized records to the frontend.

The frontend should never communicate directly with SAP.

---

# Frontend Changes

Replace the existing mock Sales API with the backend endpoint that returns normalized SAP records.

No UI redesign is required.

The existing Sales reconciliation table remains:

| PIN | Customer | Invoice | Date | CU Number | VAT Group | Base Amount |

The UI should remain independent of SAP's internal structure.

---

# Reconciliation Engine

No changes are required to the comparison algorithm.

Input:

```
Normalized SAP Records
```

vs

```
Normalized KRA CSV Records
```

Both datasets share the same schema, allowing the existing reconciliation logic to operate without modification.

---

# Benefits

- Removes dependency on mock sales data.
- Keeps the reconciliation engine ERP-agnostic.
- Simplifies frontend logic.
- Supports invoices containing multiple line items.
- Prevents mismatches caused by comparing invoice headers instead of invoice lines.
- Provides a clean abstraction layer for future ERP integrations.
- Allows SAP implementation details to evolve without impacting reconciliation logic.

---

# Implementation Checklist

- [ ] Implement SAP Service Layer authentication.
- [ ] Store and refresh SAP session cookies securely.
- [ ] Create SAP invoice service.
- [ ] Fetch Sales Invoices from `/Invoices`.
- [ ] Build invoice normalization service.
- [ ] Flatten `DocumentLines` into individual reconciliation records.
- [ ] Map SAP fields to the standardized 7-column schema.
- [ ] Replace mock Sales API with normalized SAP data endpoint.
- [ ] Verify reconciliation against KRA CSV exports.
- [ ] Remove mock Sales data from the application.