from app.schemas.invoice import Invoice
from app.schemas.reconciliation import (
    ReconciliationStatus,
    DifferenceField,
    Difference,
    ReconciliationResult,
    MismatchStats,
    ReconciliationSummary
)

# Sorting priority: duplicate/missing errors prioritized, followed by mismatches, followed by clean matches
STATUS_PRIORITY = {
    ReconciliationStatus.DUPLICATE_CU: 1,
    ReconciliationStatus.MISSING_IN_SAP: 2,
    ReconciliationStatus.MISSING_IN_KRA: 3,
    ReconciliationStatus.MULTIPLE_MISMATCHES: 4,
    ReconciliationStatus.AMOUNT_MISMATCH: 5,
    ReconciliationStatus.VAT_MISMATCH: 6,
    ReconciliationStatus.DATE_MISMATCH: 7,
    ReconciliationStatus.MATCH: 8,
}


def compare_amount(sap: Invoice, kra: Invoice) -> Difference:
    """Compare base amounts of SAP and KRA invoices."""
    match = sap.base_amount == kra.base_amount
    return Difference(
        field=DifferenceField.BASE_AMOUNT,
        match=match,
        sap_value=f"{sap.base_amount:.2f}",
        kra_value=f"{kra.base_amount:.2f}"
    )


def compare_vat(sap: Invoice, kra: Invoice) -> Difference:
    """Compare VAT groups of SAP and KRA invoices."""
    match = sap.vat_group == kra.vat_group
    return Difference(
        field=DifferenceField.VAT_GROUP,
        match=match,
        sap_value=str(sap.vat_group),
        kra_value=str(kra.vat_group)
    )


def compare_date(sap: Invoice, kra: Invoice) -> Difference:
    """Compare invoice dates of SAP and KRA invoices."""
    match = sap.invoice_date == kra.invoice_date
    return Difference(
        field=DifferenceField.INVOICE_DATE,
        match=match,
        sap_value=sap.invoice_date.isoformat(),
        kra_value=kra.invoice_date.isoformat()
    )


def reconcile_invoices(sap: list[Invoice], kra: list[Invoice]) -> tuple[ReconciliationSummary, list[ReconciliationResult]]:
    """
    Executes the reconciliation matching algorithm on SAP and KRA invoices.
    Checks only base_amount, vat_group, and invoice_date for differences.
    Returns the compiled summary metrics and line-by-line comparison results sorted deterministically.
    """
    sap_by_cu: dict[str, list[Invoice]] = {}
    kra_by_cu: dict[str, list[Invoice]] = {}

    for inv in sap:
        sap_by_cu.setdefault(inv.cu_number, []).append(inv)

    for inv in kra:
        kra_by_cu.setdefault(inv.cu_number, []).append(inv)

    results: list[ReconciliationResult] = []
    duplicate_cus = set()

    # 1. Scan for duplicate CU Numbers on either side
    all_cus = set(sap_by_cu.keys()) | set(kra_by_cu.keys())
    for cu in all_cus:
        sap_list = sap_by_cu.get(cu, [])
        kra_list = kra_by_cu.get(cu, [])

        if len(sap_list) > 1 or len(kra_list) > 1:
            duplicate_cus.add(cu)
            # Select first as representative for metadata display
            sap_inv = sap_list[0] if sap_list else None
            kra_inv = kra_list[0] if kra_list else None

            # Aggregate duplicate error result
            results.append(ReconciliationResult(
                cu_number=cu,
                sap=sap_inv,
                kra=kra_inv,
                status=ReconciliationStatus.DUPLICATE_CU,
                amount_match=False,
                vat_match=False,
                date_match=False,
                differences=[
                    Difference(
                        field=DifferenceField.BASE_AMOUNT,
                        match=False,
                        sap_value=f"{len(sap_list)} invoices" if len(sap_list) > 1 else "1 invoice" if sap_list else "None",
                        kra_value=f"{len(kra_list)} invoices" if len(kra_list) > 1 else "1 invoice" if kra_list else "None"
                    )
                ]
            ))

    # 2. Reconcile non-duplicate CU Numbers
    non_dup_sap_cus = {cu for cu, invs in sap_by_cu.items() if len(invs) == 1}
    non_dup_kra_cus = {cu for cu, invs in kra_by_cu.items() if len(invs) == 1}

    all_non_dup_cus = (non_dup_sap_cus | non_dup_kra_cus) - duplicate_cus
    for cu in all_non_dup_cus:
        if cu in non_dup_sap_cus and cu not in non_dup_kra_cus:
            sap_inv = sap_by_cu[cu][0]
            results.append(ReconciliationResult(
                cu_number=cu,
                sap=sap_inv,
                kra=None,
                status=ReconciliationStatus.MISSING_IN_KRA,
                amount_match=False,
                vat_match=False,
                date_match=False,
                differences=[]
            ))
        elif cu in non_dup_kra_cus and cu not in non_dup_sap_cus:
            kra_inv = kra_by_cu[cu][0]
            results.append(ReconciliationResult(
                cu_number=cu,
                sap=None,
                kra=kra_inv,
                status=ReconciliationStatus.MISSING_IN_SAP,
                amount_match=False,
                vat_match=False,
                date_match=False,
                differences=[]
            ))
        else:
            sap_inv = sap_by_cu[cu][0]
            kra_inv = kra_by_cu[cu][0]

            # Validate fields (base_amount, vat_group, and invoice_date only. partner_name and invoice_number are informational)
            amount_diff = compare_amount(sap_inv, kra_inv)
            vat_diff = compare_vat(sap_inv, kra_inv)
            date_diff = compare_date(sap_inv, kra_inv)

            differences = []
            if not amount_diff.match:
                differences.append(amount_diff)
            if not vat_diff.match:
                differences.append(vat_diff)
            if not date_diff.match:
                differences.append(date_diff)

            if not differences:
                status = ReconciliationStatus.MATCH
            else:
                if len(differences) > 1:
                    status = ReconciliationStatus.MULTIPLE_MISMATCHES
                else:
                    if not amount_diff.match:
                        status = ReconciliationStatus.AMOUNT_MISMATCH
                    elif not vat_diff.match:
                        status = ReconciliationStatus.VAT_MISMATCH
                    else:
                        status = ReconciliationStatus.DATE_MISMATCH

            results.append(ReconciliationResult(
                cu_number=cu,
                sap=sap_inv,
                kra=kra_inv,
                status=status,
                amount_match=amount_diff.match,
                vat_match=vat_diff.match,
                date_match=date_diff.match,
                differences=differences
            ))

    # Calculate summary metrics
    total_sap = len(sap)
    total_kra = len(kra)
    matches = sum(1 for r in results if r.status == ReconciliationStatus.MATCH)
    missing_in_sap = sum(1 for r in results if r.status == ReconciliationStatus.MISSING_IN_SAP)
    missing_in_kra = sum(1 for r in results if r.status == ReconciliationStatus.MISSING_IN_KRA)
    duplicate_cu = len(duplicate_cus)
    mismatches = sum(1 for r in results if r.status in (
        ReconciliationStatus.AMOUNT_MISMATCH,
        ReconciliationStatus.VAT_MISMATCH,
        ReconciliationStatus.DATE_MISMATCH,
        ReconciliationStatus.MULTIPLE_MISMATCHES
    ))

    total_distinct_cus = len(all_cus)
    match_percentage = (matches / total_distinct_cus) * 100.0 if total_distinct_cus > 0 else 100.0
    completion_percentage = (matches / total_sap) * 100.0 if total_sap > 0 else 100.0

    # Calculate mismatch sub-statistics
    mismatch_stats = MismatchStats(amount=0, vat=0, date=0)
    for r in results:
        if r.status in (
            ReconciliationStatus.AMOUNT_MISMATCH,
            ReconciliationStatus.VAT_MISMATCH,
            ReconciliationStatus.DATE_MISMATCH,
            ReconciliationStatus.MULTIPLE_MISMATCHES
        ):
            if not r.amount_match:
                mismatch_stats.amount += 1
            if not r.vat_match:
                mismatch_stats.vat += 1
            if not r.date_match:
                mismatch_stats.date += 1

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
        mismatch_stats=mismatch_stats
    )

    # Sort results deterministically by:
    # 1. status severity / priority (ascending)
    # 2. CU number (alphabetical)
    results.sort(key=lambda r: (STATUS_PRIORITY.get(r.status, 99), r.cu_number))

    return summary, results
