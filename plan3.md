# Implementation Plan — SAP VAT Group Normalization & Multi-VAT Group Reconciliation

## Objective

Align SAP Business One invoice data and KRA CSV upload parsing with the structure used by KRA eTIMS, allowing reconciliation of taxable amounts per VAT group rather than individual document lines or entire invoices.

The reconciliation engine is focused exclusively on three matching/validation fields:
* **Composite Reconciliation Key:** `MatchKey` = `(cu_number, vat_group)`
  * `CU Number` = invoice identity.
  * `VAT Group` = tax bucket identity.
* **Base Amount** = validation field.

Invoice numbers and invoice dates are treated as **strictly informational** in the UI and exported reports. They are not compared by the reconciliation engine, and `DATE_MISMATCH` is completely removed.

---

## Domain Definitions

### `MatchKey` (Value Object)
```python
@dataclass(frozen=True)
class MatchKey:
    cu_number: str
    vat_group: str
```
`MatchKey` is immutable and hashable so it can be used directly as a dictionary key. Every `MatchKey` is constructed exclusively from normalized `cu_number` and normalized `vat_group` values. Normalization responsibility lies entirely inside the adapters (SAP aggregation and KRA CSV parsing), ensuring that raw characters (e.g. leading pipes `|` or trailing whitespace) are stripped before `MatchKey` construction.

### `CuKey` (Value Object)
```python
@dataclass(frozen=True)
class CuKey:
    cu_number: str
```
`CuKey` is immutable and hashable, used to group unmatched records by their invoice identity during Phase 2 fallback pairing.

### `ReconciliationRecord`
```python
@dataclass(frozen=True)
class ReconciliationRecord:
    # Domain Fields (Reconciliation Engine Core)
    match_key: MatchKey
    base_amount: Decimal

    # Metadata (UI & Reporting only)
    pin: str
    partner_name: str
    invoice_number: str
    invoice_date: date

    @property
    def cu_number(self) -> str:
        return self.match_key.cu_number

    @property
    def vat_group(self) -> str:
        return self.match_key.vat_group
```
**Access Conventions:**
* **Adapters & UI:** Access fields using convenience properties: `record.cu_number` and `record.vat_group`.
* **Reconciliation Engine:** Accesses `record.match_key` directly to enforce composite-key matching.

The reconciliation engine consumes only `ReconciliationRecord` instances. Any future ERP integration (Dynamics, Oracle, Odoo, etc.) is responsible only for producing `ReconciliationRecord` instances, keeping the engine completely ERP-agnostic.

---

## Engine Preconditions & Validation Pipeline

The normalization pipelines (SAP, KRA, or future ERP adapters) are responsible only for producing normalized records. The reconciliation engine validates uniqueness of `MatchKey` before reconciliation begins:

```
                  Raw Sequences of ReconciliationRecord
                                 │
                                 ▼
                     Scan for Duplicate MatchKeys
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
  Duplicate Keys                                    Unique Keys
         │                                               │
         ▼                                               ▼
Create DUPLICATE_SOURCE_KEY                     Build Engine Indexes
Reconciliation Results                                   │
                                                         ▼
                                                Execute Phase 1 & 2 & 3
                                                         │
                                                         ▼
                                             Merge & Sort All Results
```

### Engine Invariants
* **Unique Result Invariant:** Every input record participates in exactly one terminal outcome:
  * `MATCH`
  * `AMOUNT_MISMATCH`
  * `VAT_MISMATCH`
  * `MULTIPLE_MISMATCHES`
  * `MISSING_IN_SAP`
  * `MISSING_IN_KRA`
  * `DUPLICATE_SOURCE_KEY`
  
  No record may participate in more than one terminal outcome, and no record shall appear twice in exports.
* **Duplicate Exclusion Invariant:** No `MatchKey` appearing more than once within a source shall exist in either reconciliation lookup index (`sap_index` or `kra_index`).
* **MatchKey Uniqueness Precondition:** After Phase 0 preprocessing, every `MatchKey` contained in `sap_index` maps to exactly one SAP record, and every `MatchKey` contained in `kra_index` maps to exactly one KRA record.
* **MatchKey Matching Invariant:** `MatchKey` equality is the only criterion for Phase 1 matching. No other fields (e.g. invoice_number, pin, partner_name, or invoice_date) shall influence Phase 1 matching.
* **MatchKey Isolation Invariant:** Duplicate detection is scoped strictly to `MatchKey`. Duplicate records sharing one `MatchKey` shall not prevent reconciliation of other `MatchKeys` belonging to the same `CuKey`.
* **Phase 2 Identity Invariant:** Phase 2 never changes `MatchKeys`. It merely pairs one unmatched SAP record with one unmatched KRA record sharing the same `CuKey`.
* **Engine Input Validity Invariant:** The reconciliation engine assumes every input `ReconciliationRecord` is valid. Invalid CU Numbers, invalid VAT Groups, malformed dates, or malformed amounts are rejected before reaching the engine (defensive parsing is handled exclusively at the adapter level).

### Base Amount Normalization
Base amount normalization (quantizing to two decimal places using `Decimal` values) is performed during adapter creation of `ReconciliationRecord`. The reconciliation engine assumes `base_amount` is already normalized and performs a direct equality check (`sap.base_amount == kra.base_amount`) with no internal engine-level normalization.

### Duplicate Resolution Rules
1. **Timing:** Duplicate detection occurs independently within each source (SAP and KRA) before any cross-source reconciliation begins.
2. **Exclusion:** The entire duplicate group is excluded from reconciliation. No representative record from that group is retained in the lookup index.
3. **Stable Sorting & Ordering:** Duplicate results preserve the relative ordering of the source sequence supplied to the engine by sorting on `sap_source_index` or `kra_source_index`. Results originating from the same source preserve their relative source ordering within identical reconciliation groups.
4. **Opposite-Side Fallback:** Any record on the opposite source sharing the same `MatchKey` (e.g. KRA has exactly 1 valid record, but SAP has 2 duplicate records) will fail to match in Phase 1 and Phase 2 (since the duplicate side was excluded from the index). It will fall through to Phase 3 and be reported as `MISSING_IN_SAP` (or `MISSING_IN_KRA`).
5. **Reporting:** Both duplicate records are directly emitted as `DUPLICATE_SOURCE_KEY` results in the final output list.

---

## SAP Aggregation Pipeline (SAP Mapper)

Aggregation is performed only for SAP because SAP stores invoice lines while KRA already provides VAT-group-level records. KRA records are normalized but never aggregated. 

* **Aggregation Scope / Invariant:** One SAP invoice is aggregated independently of every other invoice. SAP aggregation never combines `DocumentLines` originating from different SAP invoices, even if they share identical CU Number and VAT Group.
* **Grouping Key (within one invoice):** normalized VAT group.
* **Invoice header fields:** `(pin, partner_name, invoice_number, invoice_date, cu_number)` are copied unchanged to every aggregated record produced from that invoice.

The SAP pipeline is defined as follows:

```
SAP Invoice
     │
     ▼
Normalize VAT Groups (using VatNormalizer)
     │
     ▼
Filter Invalid Lines (apply base amount policy: SKIP / REJECT / ALLOW)
     │
     ▼
Group Lines by Normalized VAT Group (within the invoice)
     │
     ▼
Sum LineTotal (quantized to 0.01)
     │
     ▼
Create ReconciliationRecord (instantiating MatchKey)
```

---

## KRA CSV Upload Validation

Update validation in `kra_service.py` to support mixed-VAT invoices. 
* Uniqueness checks are no longer handled in the CSV validation layer. The parser is solely responsible for producing `ReconciliationRecord` instances. Uniqueness checks and duplicate detection are centralized within the reconciliation engine.
* The CSV validation layer only validates schema compliance, format parsing, and required fields.

---

## Reconciliation Engine Contract & Complexity Guarantee

### Engine Contract
* **Input:** Sequences of `ReconciliationRecord` (e.g. `sap_records: Sequence[ReconciliationRecord]`, `kra_records: Sequence[ReconciliationRecord]`).
* **Output:** `Sequence[ReconciliationResult]`
* **Assumptions:**
  * VAT is already normalized.
  * SAP is already aggregated.
  * `MatchKey` fields must be non-empty (both `cu_number` and `vat_group` must be valid, non-empty strings).
* **Guarantees:**
  * Validates uniqueness of `MatchKey` before reconciliation begins.
  * Does not perform ERP-specific logic.
  * Does not normalize VAT.
  * Does not aggregate invoice lines.
  * Does not mutate input records (`ReconciliationRecord` is immutable).
  * Preserves original metadata associated with every `ReconciliationRecord`. Metadata is never altered, merged, or synthesized by the engine.
  * Produces deterministic results.
  * **VAT Group Extensibility:** The reconciliation engine must not assume the VAT Group is a percentage. It is treated as an opaque normalized identifier (e.g., `'16'`, `'0'`, `'8'`, `'EXEMPT'`, `'EXPORT'`, `'RCM'`).

### Complexity Guarantee
* **Overall Time Complexity:** \(O(n)\) by using hash maps keyed by `MatchKey`. No nested iteration over record collections is permitted. Phase 2 groups remaining records by `CuKey` using hash maps; each remaining record is inserted once and visited once, preserving overall \(O(n)\) time.
* **Additional Memory:** \(O(n)\) to maintain lookup maps.

---

## Reconciliation Matching & Comparison Algorithm

### High-Level Summary
* **Phase 0: Preprocessing** — Identify and exclude duplicate `MatchKey` groups.
* **Phase 1: Exact Match** — Reconcile exact `MatchKey` intersections.
* **Phase 2: CU-Level VAT Resolution** — Reconcile one-to-one unmatched `CuKey` records.
* **Phase 3: Missing Detection** — Report all remaining records as missing.

### Internal Data Structures
To manage the state, the engine maintains the following internal data structures:
* `sap_index: dict[MatchKey, tuple[ReconciliationRecord, int]]` (maps composite key to the unique record and its 0-based input index)
* `kra_index: dict[MatchKey, tuple[ReconciliationRecord, int]]` (maps composite key to the unique record and its 0-based input index)
* `sap_unmatched_by_cu: dict[CuKey, list[tuple[ReconciliationRecord, int]]]`
* `kra_unmatched_by_cu: dict[CuKey, list[tuple[ReconciliationRecord, int]]]`
* `results: list[ReconciliationResult]`

---

The engine manages the single `results` collection. During Phase 0, the engine internally tracks the 0-based position of each record in the input sequences using `enumerate` and attaches it to the final `ReconciliationResult` as `sap_source_index: int | None` and `kra_source_index: int | None`.

### Phase 0: Preprocessing & Duplicate Scanning
For each source (SAP, KRA), group incoming `ReconciliationRecord` lists by `MatchKey`:
```python
for source_records in (sap_records, kra_records):
    groups = defaultdict(list)
    for i, record in enumerate(source_records):
        groups[record.match_key].append((record, i))
        
    for match_key, items in groups.items():
        if len(items) == 1:
            # Safe unique key, add to index
            source_index[match_key] = items[0]
        else:
            # Exclude entire group from matching index. Emit DUPLICATE_SOURCE_KEY for each record
            for record, source_idx in items:
                results.append(create_duplicate_result(record, source_index=source_idx))
```
This guarantees the lookup indices (`sap_index` and `kra_index`) contain only unique keys and their original ordering positions.

### Phase 1: Exact Match
* Identify the set of keys present in both indices:
  ```python
  intersection = sap_index.keys() & kra_index.keys()
  ```
* For each `MatchKey` in the intersection:
  * Extract the unique records and indices:
    ```python
    sap_rec, sap_idx = sap_index[MatchKey]
    kra_rec, kra_idx = kra_index[MatchKey]
    ```
  * Compare `base_amount` values:
    * If amounts match: results.append(create_result(sap_rec, kra_rec, sap_idx, kra_idx, status=MATCH))
    * If amounts differ: results.append(create_result(sap_rec, kra_rec, sap_idx, kra_idx, status=AMOUNT_MISMATCH))
* **Consumption:** Phase 1 consumption is represented by the `MatchKey` intersection. Records matched during Phase 1 are considered consumed and are excluded from subsequent phases.

### Phase 2: CU-Level VAT Resolution
* **Motivation:** Phase 2 exists solely to distinguish a VAT bucket mismatch from missing records. Without this step, a VAT code difference would incorrectly produce one `MISSING_IN_KRA` and one `MISSING_IN_SAP` result instead of a `VAT_MISMATCH`.
* **Phase 2 Preconditions:**
  * Phase 1 has completed.
  * `MatchKeys` differ.
  * `CuKeys` are equal.
  * Exactly one unmatched record exists per source.
  * Because exact `MatchKeys` were matched and removed during Phase 1, the VAT groups of the paired records in Phase 2 necessarily differ (`sap_rec.match_key.vat_group != kra_rec.match_key.vat_group` while `sap_rec.match_key.cu_number == kra_rec.match_key.cu_number`).
* Retrieve unmatched record instances directly:
  ```python
  remaining_sap_records = [item for k, item in sap_index.items() if k not in intersection]
  remaining_kra_records = [item for k, item in kra_index.items() if k not in intersection]
  ```
* Group remaining unmatched records by their `CuKey`:
  ```python
  sap_unmatched_by_cu = defaultdict(list)
  for record, idx in remaining_sap_records:
      sap_unmatched_by_cu[CuKey(record.cu_number)].append((record, idx))
      
  kra_unmatched_by_cu = defaultdict(list)
  for record, idx in remaining_kra_records:
      kra_unmatched_by_cu[CuKey(record.cu_number)].append((record, idx))
  ```
* **Pairing Invariant:** A Phase 2 pair always consists of exactly 1 unmatched SAP record and exactly 1 unmatched KRA record sharing the same `CuKey`. Records from the same source are never paired together. Phase 2 never attempts best-match selection; pairing occurs only when exactly one unmatched record exists on each side for the `CuKey` (Phase 2 is non-transitive and avoids heuristic best-match selection).
* **CuKey Eligibility & Execution:**
  ```python
  sap_paired_keys: set[MatchKey] = set()
  kra_paired_keys: set[MatchKey] = set()
  
  for cu_key in sap_unmatched_by_cu.keys() & kra_unmatched_by_cu.keys():
      if len(sap_unmatched_by_cu[cu_key]) == 1 and len(kra_unmatched_by_cu[cu_key]) == 1:
          sap_rec, sap_idx = sap_unmatched_by_cu[cu_key][0]
          kra_rec, kra_idx = kra_unmatched_by_cu[cu_key][0]
          
          # Compare base amounts
          if sap_rec.base_amount == kra_rec.base_amount:
              results.append(create_result(sap_rec, kra_rec, sap_idx, kra_idx, status=VAT_MISMATCH))
          else:
              results.append(create_result(sap_rec, kra_rec, sap_idx, kra_idx, status=MULTIPLE_MISMATCHES))
              
          sap_paired_keys.add(sap_rec.match_key)
          kra_paired_keys.add(kra_rec.match_key)
  ```
  If either side has more than 1 unmatched record for that `CuKey` (e.g., SAP has 2 unmatched VAT groups and KRA has 1 unmatched VAT group), do not attempt any pairing. The reconciliation engine intentionally avoids heuristic pairing when more than one unmatched VAT bucket exists for the same `CuKey`. Any automatic pairing would be arbitrary, so these records skip Phase 2 and fall through to Phase 3.
* **Consumption Rule:** Phase 2 consumption is represented by the paired key sets (`sap_paired_keys` and `kra_paired_keys`). Once paired, both the SAP record and the KRA record are consumed by recording their MatchKeys in the paired key sets. Consumed records shall never be visited again by subsequent phases.

### Phase 3: Missing Detection
* Iterate remaining unmatched records. Phase 3 filters out all consumed records:
  ```python
  remaining_sap_records = [item for k, item in sap_index.items() if k not in intersection and k not in sap_paired_keys]
  remaining_kra_records = [item for k, item in kra_index.items() if k not in intersection and k not in kra_paired_keys]
  ```
* Generate results:
  * For each `r, idx` in `remaining_sap_records`: results.append(create_result(r, None, sap_idx=idx, kra_idx=None, status=MISSING_IN_KRA))
  * For each `r, idx` in `remaining_kra_records`: results.append(create_result(None, r, sap_idx=None, kra_idx=idx, status=MISSING_IN_SAP))

### Deterministic Result Ordering
All results from Phase 0 through Phase 3 are merged into `results`. The list is sorted deterministically before display and export using the following sort key:
```python
(
    STATUS_PRIORITY[status],
    match_key.cu_number,
    match_key.vat_group,
    sap_source_index if sap_source_index is not None else -1,
    kra_source_index if kra_source_index is not None else -1
)
```

---

## Reconciliation Status Definition

Every status produced by the engine is documented below:

| Status Code | Meaning |
| :--- | :--- |
| `MATCH` | `MatchKey` found in both sources and `base_amount` is equal. |
| `AMOUNT_MISMATCH` | `MatchKey` found in both sources but `base_amount` differs. |
| `VAT_MISMATCH` | `CuKey` matched during Phase 2. VAT Group differs. Base Amount matches. |
| `MULTIPLE_MISMATCHES` | `CuKey` matched during Phase 2. VAT Group differs. Base Amount differs. |
| `MISSING_IN_SAP` | Record exists only in KRA (no matching `MatchKey` and fails Phase 2 pairing). |
| `MISSING_IN_KRA` | Record exists only in SAP (no matching `MatchKey` and fails Phase 2 pairing). |
| `DUPLICATE_SOURCE_KEY` | Duplicate `MatchKey` detected within a single source. |

---

## Frontend UI Display Formatter

Update display formatting in React components (`InvoiceTable.tsx`, `ResultsTable.tsx`) to handle non-numeric VAT groups gracefully using a generic regular expression formatting helper:
```typescript
const formatVatGroup = (vat: string) => {
  const value = vat.trim();
  return /^\d+(\.\d+)?$/.test(value) ? `${value}%` : value;
};
```
This formats numeric groups (e.g., `16`, `8`, `0`) with a `%` sign, while preserving non-numeric identifiers (e.g., `EXEMPT`, `EXPORT`, `RCM`) unchanged, eliminating whitespace discrepancies.

---

## Verification & Testing Plan

Modify the existing test suite (`tests/test_reconciliation.py` and `tests/test_sap_integration.py`):
1. **SAP Aggregation Boundaries Test:** 
   * Assert that multiple lines of the same VAT group are summed, and separate VAT groups are kept distinct. Grouping occurs correctly within the invoice boundaries.
   * Verify that Invoice A `(CU1, VAT16, 100)` and Invoice B `(CU2, VAT16, 100)` produce separate records and never combine them into a single record `(VAT16, 200)`.
2. **KRA Parser Test:** Assert that the CSV parser generates `ReconciliationRecord` instances successfully even if the file contains duplicate `cu_number` values.
3. **Engine Reconciliation Test Suite:**
   * Completely remove assertions verifying date comparisons and `DATE_MISMATCH`.
   * **Input Order Independence Test Case:** Add a test case where SAP has `(CU1, VAT16, 100)` and `(CU2, VAT16, 100)` and KRA has `(CU2, VAT16, 100)` and `(CU1, VAT16, 100)`. Verify it produces two `MATCH` results, confirming that input sequence ordering does not influence reconciliation outcomes.
   * **Exact Match Precedence Test Case:** Add a test case where SAP has `(CU1, VAT16, Amount=100)` and KRA has `(CU1, VAT16, Amount=90)`. Assert that it produces `AMOUNT_MISMATCH` to verify that exact composite-key matching takes precedence over Phase 2 fallback grouping logic.
   * **Multiple Invoices with Identical VAT Layouts Test Case:** Add a test case where SAP has `(CU1, VAT16, 100)` and `(CU2, VAT16, 100)`, and KRA has `(CU1, VAT16, 100)` and `(CU2, VAT16, 100)`. Verify it produces two `MATCH` results, confirming reconciliation is keyed by MatchKey rather than globally grouped by VAT.
   * **Multi-VAT Partial Success Test Case:** Add a test case where SAP has `(CU=100, VAT=16, Amount=100)` and `(CU=100, VAT=0, Amount=50)`, and KRA has `(CU=100, VAT=16, Amount=100)` and `(CU=100, VAT=0, Amount=60)`. Assert that it produces exactly one `MATCH` row and one `AMOUNT_MISMATCH` row. This verifies Phase 1 correctly handles partial successes within the same CU, and Phase 2 fallback is not invoked.
   * **Multi-VAT Perfect Match Test Case:** SAP has `(123, '16')` and `(123, 'EXEMPT')`. KRA has `(123, '16')` and `(123, 'EXEMPT')`. Assert it produces 2 matched rows.
   * **VAT Mismatch Test Case:** SAP has `(123, '16')`. KRA has `(123, '0')`. Assert it produces 1 paired row with `VAT_MISMATCH`.
   * **Multiple Mismatches Test Case:** SAP has `(123, '16')`. KRA has `(123, '0')` with different base amount. Assert it produces `MULTIPLE_MISMATCHES`.
   * **Decimal Normalization Test Case:** SAP has `(123, '16', 100.0)`. KRA has `(123, '16', 100.00)`. Assert that adapter normalization produces a `MATCH`.
   * **Duplicate Record Test Case (Opposite-Side Fallback):** SAP has two duplicate copies of `(123, '16')`. KRA has one copy of `(123, '16')`. Assert that the output contains two `DUPLICATE_SOURCE_KEY` rows (from SAP) and one `MISSING_IN_SAP` row (representing KRA's unmatched record since the SAP duplicates were excluded from the index).
   * **Symmetric Duplicate Test Case:** SAP has `(CU100, VAT16, 100)`. KRA has two duplicate copies of `(CU100, VAT16, 100)`. Assert that the output contains two `DUPLICATE_SOURCE_KEY` rows (from KRA) and one `MISSING_IN_KRA` row (for SAP's unmatched record).
   * **Duplicate Dominance Test Case:**
     * SAP: `(CU1, VAT16, 100)`
     * KRA: `(CU1, VAT16, 100)`, `(CU1, VAT16, 100)` (duplicates)
     * Assert output: two `DUPLICATE_SOURCE_KEY` rows (from KRA) and one `MISSING_IN_KRA` row (for SAP's unmatched record).
   * **Duplicate Isolation Test Case:**
     * SAP: `(CU100, VAT16, Amount=100)`, `(CU100, VAT16, Amount=100)` (duplicates), and `(CU200, VAT16, Amount=200)`
     * KRA: `(CU100, VAT16, Amount=100)`, `(CU200, VAT16, Amount=200)`
     * Assert output: two `DUPLICATE_SOURCE_KEY` results (from SAP), one `MISSING_IN_SAP` result (representing KRA's unmatched CU100), and one `MATCH` result (for CU200). This verifies duplicate processing for one CU does not affect reconciliation of unrelated CUs.
   * **Duplicate Isolation Within Same CU Test Case:**
     * SAP: `(CU1, VAT16, Amount=100)`, `(CU1, VAT16, Amount=100)` (duplicates), and `(CU1, VAT0, Amount=50)`
     * KRA: `(CU1, VAT0, Amount=50)`
     * Assert output: two `DUPLICATE_SOURCE_KEY` rows (from SAP) and one `MATCH` row (for VAT0). This verifies duplicates on one MatchKey do not invalidate reconciliation of different MatchKeys belonging to the same CU.
   * **Mixed Duplicate + Ambiguity Test Case:**
     * SAP: `(CU1, VAT16, 100)`, `(CU1, VAT16, 100)` (duplicates), and `(CU1, VAT8, 50)`
     * KRA: `(CU1, VAT0, 50)`
     * Assert output: two `DUPLICATE_SOURCE_KEY` results, one `MISSING_IN_KRA` (for VAT8), and one `MISSING_IN_SAP` (for VAT0). No `VAT_MISMATCH` pairing occurs, verifying Phase 2 ignores duplicate-excluded keys.
   * **Ambiguity Bypass Test Case:**
     * SAP: `(CU1, VAT16, 100)`, `(CU1, VAT8, 50)`, `(CU1, VAT0, 50)`
     * KRA: `(CU1, VAT16, 100)`, `(CU1, VATX, 50)`, `(CU1, VATY, 50)`
     * Assert output: one `MATCH` result (for VAT16), two `MISSING_IN_KRA` results (for SAP's VAT8 and VAT0), and two `MISSING_IN_SAP` results (for KRA's VATX and VATY). This confirms Phase 2 refuses heuristic pairing when multiple candidates remain after successful exact matches.
