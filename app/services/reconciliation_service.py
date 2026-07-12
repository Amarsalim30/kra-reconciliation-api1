from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from datetime import date
from typing import Sequence, Dict, List, Set, Tuple

from app.schemas.invoice import Invoice, InvoiceSource
from app.schemas.reconciliation import (
    DifferenceField,
    Difference,
    ReconciliationResult,
    MismatchStats,
    ReconciliationSummary
)
from app.domain.reconciliation_status import ReconciliationStatus
from app.domain.reconciliation_constants import STATUS_PRIORITY


@dataclass(frozen=True)
class MatchKey:
    cu_number: str
    vat_group: str


@dataclass(frozen=True)
class CuKey:
    cu_number: str


@dataclass(frozen=True)
class ReconciliationRecord:
    match_key: MatchKey
    base_amount: Decimal
    pin: str
    partner_name: str
    invoice_number: str
    invoice_date: date
    original_invoice: Invoice

    @property
    def cu_number(self) -> str:
        return self.match_key.cu_number

    @property
    def vat_group(self) -> str:
        return self.match_key.vat_group


def reconcile_invoices(
    sap: list[Invoice],
    kra: list[Invoice]
) -> tuple[ReconciliationSummary, list[ReconciliationResult]]:
    """
    Executes the 4-phase reconciliation matching algorithm on SAP and KRA invoices.
    Uses MatchKey and CuKey abstractions for ERP-agnostic, deterministic O(n) reconciliation.
    """
    results: list[ReconciliationResult] = []

    # Map input lists to ReconciliationRecord instances
    sap_records = [
        ReconciliationRecord(
            match_key=MatchKey(cu_number=inv.normalized_cu_number, vat_group=inv.normalized_vat_group),
            base_amount=inv.base_amount,
            pin=inv.normalized_pin,
            partner_name=inv.partner_name,
            invoice_number=inv.invoice_number,
            invoice_date=inv.invoice_date,
            original_invoice=inv
        )
        for inv in sap
    ]
    kra_records = [
        ReconciliationRecord(
            match_key=MatchKey(cu_number=inv.normalized_cu_number, vat_group=inv.normalized_vat_group),
            base_amount=inv.base_amount,
            pin=inv.normalized_pin,
            partner_name=inv.partner_name,
            invoice_number=inv.invoice_number,
            invoice_date=inv.invoice_date,
            original_invoice=inv
        )
        for inv in kra
    ]

    # Internal lookup indices mapping MatchKey to (ReconciliationRecord, source_index)
    sap_index: dict[MatchKey, tuple[ReconciliationRecord, int]] = {}
    kra_index: dict[MatchKey, tuple[ReconciliationRecord, int]] = {}

    # Phase 0: Preprocessing & Duplicate Scanning
    for source_records, source_index_map in ((sap_records, sap_index), (kra_records, kra_index)):
        groups = defaultdict(list)
        for i, record in enumerate(source_records):
            groups[record.match_key].append((record, i))
            
        for match_key, items in groups.items():
            if len(items) == 1:
                # Safe unique key, add to index
                source_index_map[match_key] = items[0]
            else:
                # Exclude entire group from matching index. Emit DUPLICATE_SOURCE_KEY for each record
                for record, source_idx in items:
                    is_sap = record.original_invoice.source == InvoiceSource.SAP
                    results.append(ReconciliationResult(
                        cu_number=record.cu_number,
                        sap=record.original_invoice if is_sap else None,
                        kra=record.original_invoice if not is_sap else None,
                        status=ReconciliationStatus.DUPLICATE_SOURCE_KEY,
                        amount_match=False,
                        vat_match=False,
                        date_match=True,  # Date check removed, default to True
                        differences=[
                            Difference(
                                field=DifferenceField.BASE_AMOUNT,
                                match=False,
                                sap_value=f"Duplicate MatchKey '{match_key.cu_number} / {match_key.vat_group}'" if is_sap else "None",
                                kra_value=f"Duplicate MatchKey '{match_key.cu_number} / {match_key.vat_group}'" if not is_sap else "None"
                            )
                        ],
                        sap_source_index=source_idx if is_sap else None,
                        kra_source_index=source_idx if not is_sap else None
                    ))

    # Phase 1: Exact Match
    intersection = sap_index.keys() & kra_index.keys()
    for match_key in intersection:
        sap_rec, sap_idx = sap_index[match_key]
        kra_rec, kra_idx = kra_index[match_key]
        
        amount_match = sap_rec.base_amount == kra_rec.base_amount
        
        differences = []
        if not amount_match:
            differences.append(Difference(
                field=DifferenceField.BASE_AMOUNT,
                match=False,
                sap_value=f"{sap_rec.base_amount:.2f}",
                kra_value=f"{kra_rec.base_amount:.2f}"
            ))
            
        status = ReconciliationStatus.MATCH if amount_match else ReconciliationStatus.AMOUNT_MISMATCH
        
        results.append(ReconciliationResult(
            cu_number=match_key.cu_number,
            sap=sap_rec.original_invoice,
            kra=kra_rec.original_invoice,
            status=status,
            amount_match=amount_match,
            vat_match=True,  # MatchKey matched, so VAT group matches
            date_match=True,
            differences=differences,
            sap_source_index=sap_idx,
            kra_source_index=kra_idx
        ))

    # Phase 2: CU-Level VAT Resolution
    # Retrieve unmatched record instances directly
    remaining_sap_records = [item for k, item in sap_index.items() if k not in intersection]
    remaining_kra_records = [item for k, item in kra_index.items() if k not in intersection]
    
    # Group remaining unmatched records by their CuKey
    sap_unmatched_by_cu = defaultdict(list)
    for record, idx in remaining_sap_records:
        sap_unmatched_by_cu[CuKey(record.cu_number)].append((record, idx))
        
    kra_unmatched_by_cu = defaultdict(list)
    for record, idx in remaining_kra_records:
        kra_unmatched_by_cu[CuKey(record.cu_number)].append((record, idx))

    sap_paired_keys: set[MatchKey] = set()
    kra_paired_keys: set[MatchKey] = set()

    for cu_key in sap_unmatched_by_cu.keys() & kra_unmatched_by_cu.keys():
        if len(sap_unmatched_by_cu[cu_key]) == 1 and len(kra_unmatched_by_cu[cu_key]) == 1:
            sap_rec, sap_idx = sap_unmatched_by_cu[cu_key][0]
            kra_rec, kra_idx = kra_unmatched_by_cu[cu_key][0]
            
            # Compare base amounts (VAT groups differ)
            amount_match = sap_rec.base_amount == kra_rec.base_amount
            
            differences = [
                Difference(
                    field=DifferenceField.VAT_GROUP,
                    match=False,
                    sap_value=sap_rec.vat_group,
                    kra_value=kra_rec.vat_group
                )
            ]
            if not amount_match:
                differences.append(Difference(
                    field=DifferenceField.BASE_AMOUNT,
                    match=False,
                    sap_value=f"{sap_rec.base_amount:.2f}",
                    kra_value=f"{kra_rec.base_amount:.2f}"
                ))
                
            status = ReconciliationStatus.VAT_MISMATCH if amount_match else ReconciliationStatus.MULTIPLE_MISMATCHES
            
            results.append(ReconciliationResult(
                cu_number=cu_key.cu_number,
                sap=sap_rec.original_invoice,
                kra=kra_rec.original_invoice,
                status=status,
                amount_match=amount_match,
                vat_match=False,
                date_match=True,
                differences=differences,
                sap_source_index=sap_idx,
                kra_source_index=kra_idx
            ))
            
            sap_paired_keys.add(sap_rec.match_key)
            kra_paired_keys.add(kra_rec.match_key)

    # Phase 3: Missing Detection
    remaining_sap_records_final = [
        item for k, item in sap_index.items()
        if k not in intersection and k not in sap_paired_keys
    ]
    remaining_kra_records_final = [
        item for k, item in kra_index.items()
        if k not in intersection and k not in kra_paired_keys
    ]

    for sap_rec, sap_idx in remaining_sap_records_final:
        results.append(ReconciliationResult(
            cu_number=sap_rec.cu_number,
            sap=sap_rec.original_invoice,
            kra=None,
            status=ReconciliationStatus.MISSING_IN_KRA,
            amount_match=False,
            vat_match=False,
            date_match=True,
            differences=[],
            sap_source_index=sap_idx,
            kra_source_index=None
        ))

    for kra_rec, kra_idx in remaining_kra_records_final:
        results.append(ReconciliationResult(
            cu_number=kra_rec.cu_number,
            sap=None,
            kra=kra_rec.original_invoice,
            status=ReconciliationStatus.MISSING_IN_SAP,
            amount_match=False,
            vat_match=False,
            date_match=True,
            differences=[],
            sap_source_index=None,
            kra_source_index=kra_idx
        ))

    # Calculate summary metrics
    total_sap = len(sap)
    total_kra = len(kra)
    matches = sum(1 for r in results if r.status == ReconciliationStatus.MATCH)
    missing_in_sap = sum(1 for r in results if r.status == ReconciliationStatus.MISSING_IN_SAP)
    missing_in_kra = sum(1 for r in results if r.status == ReconciliationStatus.MISSING_IN_KRA)
    duplicate_cu = sum(1 for r in results if r.status == ReconciliationStatus.DUPLICATE_SOURCE_KEY)
    mismatches = sum(1 for r in results if r.status in (
        ReconciliationStatus.AMOUNT_MISMATCH,
        ReconciliationStatus.VAT_MISMATCH,
        ReconciliationStatus.MULTIPLE_MISMATCHES
    ))

    total_distinct = len(results)
    match_percentage = (matches / total_distinct) * 100.0 if total_distinct > 0 else 100.0
    completion_percentage = (matches / total_sap) * 100.0 if total_sap > 0 else 100.0

    mismatch_stats = MismatchStats(amount=0, vat=0, date=0)
    for r in results:
        if r.status in (
            ReconciliationStatus.AMOUNT_MISMATCH,
            ReconciliationStatus.VAT_MISMATCH,
            ReconciliationStatus.MULTIPLE_MISMATCHES
        ):
            if not r.amount_match:
                mismatch_stats.amount += 1
            if not r.vat_match:
                mismatch_stats.vat += 1

    summary = ReconciliationSummary(
        total_sap=total_sap,
        total_kra=total_kra,
        matches=matches,
        missing_in_sap=missing_in_sap,
        missing_in_kra=missing_in_kra,
        mismatches=mismatches,
        duplicate_cu=duplicate_cu,
        match_percentage=match_percentage,
        completion_percentage=completion_percentage,
        total_reconciled_rows=total_distinct,
        mismatch_stats=mismatch_stats
    )

    # Sort results deterministically by:
    # 1. status priority (severity)
    # 2. CU number
    # 3. VAT Group
    # 4. SAP source index
    # 5. KRA source index
    def get_sort_key(r: ReconciliationResult):
        vat_group = ""
        if r.sap:
            vat_group = r.sap.vat_group
        elif r.kra:
            vat_group = r.kra.vat_group
            
        sap_idx = r.sap_source_index if r.sap_source_index is not None else -1
        kra_idx = r.kra_source_index if r.kra_source_index is not None else -1
        
        return (
            STATUS_PRIORITY.get(r.status, 99),
            r.cu_number,
            vat_group,
            sap_idx,
            kra_idx
        )

    results.sort(key=get_sort_key)

    return summary, results
