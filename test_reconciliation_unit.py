from app.schemas.invoice import Invoice, InvoiceSource
from app.services.reconciliation_service import check_pin_matches, check_partner_name_matches
from decimal import Decimal
from datetime import date

def test_pin_and_partner_name_matches():
    # Case A: SAP PIN missing, Partner Names match
    sap = Invoice(
        pin="",
        partner_name="Aspendos Diary Limited",
        invoice_number="INV1",
        invoice_date=date(2023, 1, 1),
        cu_number="CU1",
        vat_group="16",
        base_amount=Decimal("100"),
        source=InvoiceSource.SAP
    )
    kra = Invoice(
        pin="P051129478N",
        partner_name="Aspendos Dairy Limited",
        invoice_number="INV1",
        invoice_date=date(2023, 1, 1),
        cu_number="CU1",
        vat_group="16",
        base_amount=Decimal("100"),
        source=InvoiceSource.KRA
    )
    
    assert check_pin_matches(sap, kra) is True, "Case A PIN matches should be True (missing SAP PIN is informational)"
    assert check_partner_name_matches(sap, kra) is True, "Case A Partner Name matches should be True (fuzzy match)"

    # Case B: SAP PIN missing, Partner Names DO NOT match
    sap_diff_name = Invoice(
        pin="",
        partner_name="Gulf Power",
        invoice_number="INV1",
        invoice_date=date(2023, 1, 1),
        cu_number="CU1",
        vat_group="16",
        base_amount=Decimal("100"),
        source=InvoiceSource.SAP
    )
    kra_diff_name = Invoice(
        pin="P051129478N",
        partner_name="AGRICHEM AFRICA LIMITED",
        invoice_number="INV1",
        invoice_date=date(2023, 1, 1),
        cu_number="CU1",
        vat_group="16",
        base_amount=Decimal("100"),
        source=InvoiceSource.KRA
    )
    assert check_pin_matches(sap_diff_name, kra_diff_name) is True, "Case B PIN matches should be True"
    assert check_partner_name_matches(sap_diff_name, kra_diff_name) is False, "Case B Partner Name matches should be False"

    # Case C: Both systems contain PINs and the PINs differ
    sap_diff_pin = Invoice(
        pin="P051303453V",
        partner_name="Aspendos Diary Limited",
        invoice_number="INV1",
        invoice_date=date(2023, 1, 1),
        cu_number="CU1",
        vat_group="16",
        base_amount=Decimal("100"),
        source=InvoiceSource.SAP
    )
    kra_diff_pin = Invoice(
        pin="P051421525N",
        partner_name="Aspendos Dairy Limited",
        invoice_number="INV1",
        invoice_date=date(2023, 1, 1),
        cu_number="CU1",
        vat_group="16",
        base_amount=Decimal("100"),
        source=InvoiceSource.KRA
    )
    assert check_pin_matches(sap_diff_pin, kra_diff_pin) is False, "Case C PIN matches should be False"
    assert check_partner_name_matches(sap_diff_pin, kra_diff_pin) is True, "Case C Partner Name matches should be True"

    print("All PIN and Partner Name business rules match validation!")

if __name__ == "__main__":
    test_pin_and_partner_name_matches()
