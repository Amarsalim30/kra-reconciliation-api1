import datetime
from decimal import Decimal
from unittest.mock import MagicMock, patch
import pytest

from app.schemas.invoice import Invoice, InvoiceSource, ReconciliationType
from app.services.sap_mapper import map_sap_document_to_canonical_rows
from app.services.normalization import normalize_invoice_data
from app.services.reconciliation_service import reconcile_invoices
from app.core.sap_client import SAPClient
from app.services import invoice_service


def test_missing_cu_number_and_partner_name_ingested():
    # Verify that raw document with missing U_CUINV (CU Number) and CardName (Customer name) is imported
    # (previously U_CUINV and CardName missing would raise SAPQueryError)
    raw_doc = {
        "DocNum": 12345,
        "DocDate": "2026-03-02T00:00:00Z",
        # Missing CardName and U_CUINV
        "DocumentLines": [
            {"VatGroup": "O1", "LineTotal": 1000.00}
        ]
    }
    
    rows = map_sap_document_to_canonical_rows(raw_doc, "Invoice", "Invoices")
    assert len(rows) == 1
    assert rows[0].cu_number == ""
    assert rows[0].partner_name == ""
    assert rows[0].pin == ""  # PIN is also missing/empty

    # Test normalization function directly
    normalized = normalize_invoice_data(
        pin=None,
        partner_name=None,
        invoice_number="12345",
        invoice_date="2026-03-02",
        cu_number=None,
        vat_group="16.0",
        base_amount=1000.00,
        allow_negative=True
    )
    assert normalized["pin"] == ""
    assert normalized["partner_name"] == ""
    assert normalized["cu_number"] == ""


def test_cancelled_documents_excluded_in_query():
    # Verify that cancelled documents are excluded by checking the OData filter string
    client = SAPClient()
    client.base_url = "https://sap-test:50000/b1s/v1"
    client.username = "user"
    client.password = MagicMock()
    client.password.get_secret_value.return_value = "pass"
    client.company_db = "db"
    client.session_id = "test-session"
    client.cookies = {}
    client.session_expiry = datetime.datetime.now() + datetime.timedelta(minutes=10)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"value": []}

    with patch.object(client, "_execute_request_with_retry", return_value=mock_response) as mock_exec:
        # Consume the generator to trigger the request
        list(client.get_documents_pages("2026-03-01", "2026-03-02", "Invoices"))
        
        # Verify that Cancelled eq 'tNO' is in the request filter query
        mock_exec.assert_called_once()
        args, kwargs = mock_exec.call_args
        params = kwargs.get("params", {})
        filter_str = params.get("$filter", "")
        assert "Cancelled eq 'tNO'" in filter_str


def test_draft_documents_excluded_from_endpoints():
    # Verify draft documents endpoint is never queried when fetching invoices
    with patch("app.core.sap_client.SAPClient.get_documents_pages", return_value=[]) as mock_get:
        invoice_service.get_invoices(
            from_date=datetime.date(2026, 3, 1),
            to_date=datetime.date(2026, 3, 30),
            reconciliation_type=ReconciliationType.SALES
        )
        
        # Check called endpoints: should only query Invoices and CreditNotes, never Drafts or DocumentDrafts
        called_endpoints = []
        for call in mock_get.mock_calls:
            args = call[1]
            kwargs = call[2]
            if "endpoint_name" in kwargs:
                called_endpoints.append(kwargs["endpoint_name"])
            elif len(args) >= 3:
                called_endpoints.append(args[2])
                
        assert "Invoices" in called_endpoints
        assert "CreditNotes" in called_endpoints
        assert "Drafts" not in called_endpoints
        assert "DocumentDrafts" not in called_endpoints


def test_amount_tolerance_matching():
    # Amount tolerance = 10.00 KES
    tolerance = Decimal("10.00")
    
    sap_inv = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=datetime.date(2026, 3, 1), cu_number="CU1", vat_group="16",
        base_amount=Decimal("100.00"), source=InvoiceSource.SAP
    )
    
    # 1. Difference of 9.99 KES -> Match
    kra_9_99 = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=datetime.date(2026, 3, 1), cu_number="CU1", vat_group="16",
        base_amount=Decimal("109.99"), source=InvoiceSource.KRA
    )
    summary_9_99, results_9_99 = reconcile_invoices([sap_inv], [kra_9_99], amount_tolerance=tolerance)
    assert summary_9_99.matches == 1
    assert results_9_99[0].amount_match is True
    assert len(results_9_99[0].differences) == 0

    # 2. Difference of exactly 10.00 KES -> Match
    kra_10_00 = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=datetime.date(2026, 3, 1), cu_number="CU1", vat_group="16",
        base_amount=Decimal("110.00"), source=InvoiceSource.KRA
    )
    summary_10_00, results_10_00 = reconcile_invoices([sap_inv], [kra_10_00], amount_tolerance=tolerance)
    assert summary_10_00.matches == 1
    assert results_10_00[0].amount_match is True
    assert len(results_10_00[0].differences) == 0

    # 3. Difference of 10.01 KES -> Amount Mismatch
    kra_10_01 = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=datetime.date(2026, 3, 1), cu_number="CU1", vat_group="16",
        base_amount=Decimal("110.01"), source=InvoiceSource.KRA
    )
    summary_10_01, results_10_01 = reconcile_invoices([sap_inv], [kra_10_01], amount_tolerance=tolerance)
    assert summary_10_01.matches == 0
    assert summary_10_01.mismatches == 1
    assert results_10_01[0].amount_match is False
    assert len(results_10_01[0].differences) == 1
    assert results_10_01[0].differences[0].field == "base_amount"


def test_empty_cu_numbers_do_not_match():
    # Verify that two records with empty CU numbers do not match in Phase 1 or 2, and remain separate.
    sap_inv = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=datetime.date(2026, 3, 1), cu_number="", vat_group="16",
        base_amount=Decimal("100.00"), source=InvoiceSource.SAP
    )
    kra_inv = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=datetime.date(2026, 3, 1), cu_number="", vat_group="16",
        base_amount=Decimal("100.00"), source=InvoiceSource.KRA
    )
    
    summary, results = reconcile_invoices([sap_inv], [kra_inv], amount_tolerance=Decimal("10.00"))
    # Should not pair them. They should remain as MISSING_IN_KRA (for SAP) and MISSING_IN_SAP (for KRA).
    assert summary.matches == 0
    assert summary.missing_in_kra == 1
    assert summary.missing_in_sap == 1
    assert len(results) == 2


def test_amount_tolerance_sign_check():
    # Verify that even if difference is <= tolerance, different signs do not match.
    sap_inv = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=datetime.date(2026, 3, 1), cu_number="CU1", vat_group="16",
        base_amount=Decimal("2.00"), source=InvoiceSource.SAP
    )
    kra_inv = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=datetime.date(2026, 3, 1), cu_number="CU1", vat_group="16",
        base_amount=Decimal("-2.00"), source=InvoiceSource.KRA
    )
    
    summary, results = reconcile_invoices([sap_inv], [kra_inv], amount_tolerance=Decimal("10.00"))
    assert summary.matches == 0
    assert summary.mismatches == 1
    assert results[0].amount_match is False
