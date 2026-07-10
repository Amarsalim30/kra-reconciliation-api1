import pytest
import io
from datetime import date
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.database.database import get_db
from app.main import app
from app.schemas.invoice import Invoice, InvoiceSource
from app.schemas.reconciliation import ReconciliationStatus, DifferenceField
from app.services import reconciliation_service

# Setup test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_recon_db.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="db_session", scope="function")
def fixture_db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(name="client", scope="function")
def fixture_client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(name="auth_headers", scope="function")
def fixture_auth_headers(client):
    register_payload = {
        "username": "recon_tester",
        "password": "securepassword123",
        "email": "recon_tester@example.com",
    }
    client.post("/api/v1/auth/register", json=register_payload)

    login_payload = {
        "username": "recon_tester",
        "password": "securepassword123",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# --- Unit Tests for Reconciliation Service ---

def test_reconcile_invoices_various_cases():
    # 1. Setup mock invoices
    # Matches
    sap_match = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=date(2026, 3, 1), cu_number="CU_MATCH", vat_group="16",
        base_amount=Decimal("100.00"), source=InvoiceSource.SAP
    )
    kra_match = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=date(2026, 3, 1), cu_number="CU_MATCH", vat_group="16",
        base_amount=Decimal("100.00"), source=InvoiceSource.KRA
    )

    # Amount Mismatch
    sap_amt_mis = Invoice(
        pin="P2", partner_name="Cust2", invoice_number="INV2",
        invoice_date=date(2026, 3, 2), cu_number="CU_AMT", vat_group="16",
        base_amount=Decimal("200.00"), source=InvoiceSource.SAP
    )
    kra_amt_mis = Invoice(
        pin="P2", partner_name="Cust2", invoice_number="INV2",
        invoice_date=date(2026, 3, 2), cu_number="CU_AMT", vat_group="16",
        base_amount=Decimal("250.00"), source=InvoiceSource.KRA
    )

    # VAT Mismatch
    sap_vat_mis = Invoice(
        pin="P3", partner_name="Cust3", invoice_number="INV3",
        invoice_date=date(2026, 3, 3), cu_number="CU_VAT", vat_group="16",
        base_amount=Decimal("300.00"), source=InvoiceSource.SAP
    )
    kra_vat_mis = Invoice(
        pin="P3", partner_name="Cust3", invoice_number="INV3",
        invoice_date=date(2026, 3, 3), cu_number="CU_VAT", vat_group="0",
        base_amount=Decimal("300.00"), source=InvoiceSource.KRA
    )

    # Date Mismatch
    sap_date_mis = Invoice(
        pin="P4", partner_name="Cust4", invoice_number="INV4",
        invoice_date=date(2026, 3, 4), cu_number="CU_DATE", vat_group="16",
        base_amount=Decimal("400.00"), source=InvoiceSource.SAP
    )
    kra_date_mis = Invoice(
        pin="P4", partner_name="Cust4", invoice_number="INV4",
        invoice_date=date(2026, 3, 5), cu_number="CU_DATE", vat_group="16",
        base_amount=Decimal("400.00"), source=InvoiceSource.KRA
    )

    # Multiple Mismatches (Amount + VAT)
    sap_multi = Invoice(
        pin="P5", partner_name="Cust5", invoice_number="INV5",
        invoice_date=date(2026, 3, 5), cu_number="CU_MULTI", vat_group="16",
        base_amount=Decimal("500.00"), source=InvoiceSource.SAP
    )
    kra_multi = Invoice(
        pin="P5", partner_name="Cust5", invoice_number="INV5",
        invoice_date=date(2026, 3, 5), cu_number="CU_MULTI", vat_group="0",
        base_amount=Decimal("550.00"), source=InvoiceSource.KRA
    )

    # Missing in SAP
    kra_only = Invoice(
        pin="P6", partner_name="Cust6", invoice_number="INV6",
        invoice_date=date(2026, 3, 6), cu_number="CU_KRA_ONLY", vat_group="16",
        base_amount=Decimal("600.00"), source=InvoiceSource.KRA
    )

    # Missing in KRA
    sap_only = Invoice(
        pin="P7", partner_name="Cust7", invoice_number="INV7",
        invoice_date=date(2026, 3, 7), cu_number="CU_SAP_ONLY", vat_group="16",
        base_amount=Decimal("700.00"), source=InvoiceSource.SAP
    )

    # 2. Run reconciliation
    sap_invoices = [sap_match, sap_amt_mis, sap_vat_mis, sap_date_mis, sap_multi, sap_only]
    kra_invoices = [kra_match, kra_amt_mis, kra_vat_mis, kra_date_mis, kra_multi, kra_only]

    summary, results = reconciliation_service.reconcile_invoices(sap_invoices, kra_invoices)

    # 3. Assert Summary metrics
    assert summary.total_sap == 6
    assert summary.total_kra == 6
    assert summary.matches == 1
    assert summary.missing_in_sap == 1
    assert summary.missing_in_kra == 1
    assert summary.mismatches == 4
    assert summary.duplicate_cu == 0
    # Match percentage = (matches / total_distinct_cus) * 100
    # Total distinct cus = MATCH, AMT, VAT, DATE, MULTI, KRA_ONLY, SAP_ONLY = 7
    # (1 / 7) * 100 = 14.2857%
    assert round(summary.match_percentage, 2) == 14.29
    # Completion percentage = (matches / total_sap) * 100
    # (1 / 6) * 100 = 16.6667%
    assert round(summary.completion_percentage, 2) == 16.67

    # Assert Mismatch stats
    assert summary.mismatch_stats.amount == 2 # AMT, MULTI
    assert summary.mismatch_stats.vat == 2    # VAT, MULTI
    assert summary.mismatch_stats.date == 1   # DATE

    # 4. Assert individual results
    res_dict = {r.cu_number: r for r in results}

    # Match CU
    assert res_dict["CU_MATCH"].status == ReconciliationStatus.MATCH
    assert res_dict["CU_MATCH"].amount_match is True
    assert res_dict["CU_MATCH"].vat_match is True
    assert res_dict["CU_MATCH"].date_match is True
    assert len(res_dict["CU_MATCH"].differences) == 0

    # Amount mismatch CU
    assert res_dict["CU_AMT"].status == ReconciliationStatus.AMOUNT_MISMATCH
    assert res_dict["CU_AMT"].amount_match is False
    assert len(res_dict["CU_AMT"].differences) == 1
    assert res_dict["CU_AMT"].differences[0].field == DifferenceField.BASE_AMOUNT
    assert res_dict["CU_AMT"].differences[0].sap_value == "200.00"
    assert res_dict["CU_AMT"].differences[0].kra_value == "250.00"

    # VAT mismatch CU
    assert res_dict["CU_VAT"].status == ReconciliationStatus.VAT_MISMATCH
    assert res_dict["CU_VAT"].vat_match is False
    assert len(res_dict["CU_VAT"].differences) == 1
    assert res_dict["CU_VAT"].differences[0].field == DifferenceField.VAT_GROUP
    assert res_dict["CU_VAT"].differences[0].sap_value == "16"
    assert res_dict["CU_VAT"].differences[0].kra_value == "0"

    # Date mismatch CU
    assert res_dict["CU_DATE"].status == ReconciliationStatus.DATE_MISMATCH
    assert res_dict["CU_DATE"].date_match is False
    assert len(res_dict["CU_DATE"].differences) == 1
    assert res_dict["CU_DATE"].differences[0].field == DifferenceField.INVOICE_DATE
    assert res_dict["CU_DATE"].differences[0].sap_value == "2026-03-04"
    assert res_dict["CU_DATE"].differences[0].kra_value == "2026-03-05"

    # Multiple mismatches CU
    assert res_dict["CU_MULTI"].status == ReconciliationStatus.MULTIPLE_MISMATCHES
    assert res_dict["CU_MULTI"].amount_match is False
    assert res_dict["CU_MULTI"].vat_match is False
    assert len(res_dict["CU_MULTI"].differences) == 2

    # Missing in KRA
    assert res_dict["CU_SAP_ONLY"].status == ReconciliationStatus.MISSING_IN_KRA
    assert res_dict["CU_SAP_ONLY"].sap is not None
    assert res_dict["CU_SAP_ONLY"].kra is None

    # Missing in SAP
    assert res_dict["CU_KRA_ONLY"].status == ReconciliationStatus.MISSING_IN_SAP
    assert res_dict["CU_KRA_ONLY"].sap is None
    assert res_dict["CU_KRA_ONLY"].kra is not None


def test_reconcile_invoices_resilient_duplicate_cu():
    # Test that duplicate CU only flags duplicates and doesn't block others
    sap_dup1 = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=date(2026, 3, 1), cu_number="CU_DUP", vat_group="16",
        base_amount=Decimal("100.00"), source=InvoiceSource.SAP
    )
    sap_dup2 = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1_ALT",
        invoice_date=date(2026, 3, 1), cu_number="CU_DUP", vat_group="16",
        base_amount=Decimal("100.00"), source=InvoiceSource.SAP
    )
    sap_match = Invoice(
        pin="P2", partner_name="Cust2", invoice_number="INV2",
        invoice_date=date(2026, 3, 2), cu_number="CU_MATCH", vat_group="16",
        base_amount=Decimal("200.00"), source=InvoiceSource.SAP
    )
    
    kra_dup = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=date(2026, 3, 1), cu_number="CU_DUP", vat_group="16",
        base_amount=Decimal("100.00"), source=InvoiceSource.KRA
    )
    kra_match = Invoice(
        pin="P2", partner_name="Cust2", invoice_number="INV2",
        invoice_date=date(2026, 3, 2), cu_number="CU_MATCH", vat_group="16",
        base_amount=Decimal("200.00"), source=InvoiceSource.KRA
    )

    summary, results = reconciliation_service.reconcile_invoices(
        [sap_dup1, sap_dup2, sap_match],
        [kra_dup, kra_match]
    )

    assert summary.total_sap == 3
    assert summary.total_kra == 2
    assert summary.matches == 1
    assert summary.duplicate_cu == 1
    assert summary.mismatches == 0

    res_dict = {r.cu_number: r for r in results}
    assert res_dict["CU_MATCH"].status == ReconciliationStatus.MATCH
    assert res_dict["CU_DUP"].status == ReconciliationStatus.DUPLICATE_CU


def test_reconcile_invoices_empty_sources():
    # Empty SAP, non-empty KRA
    kra_inv = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=date(2026, 3, 1), cu_number="CU1", vat_group="16",
        base_amount=Decimal("100.00"), source=InvoiceSource.KRA
    )
    summary, results = reconciliation_service.reconcile_invoices([], [kra_inv])
    assert summary.total_sap == 0
    assert summary.total_kra == 1
    assert summary.matches == 0
    assert summary.missing_in_sap == 1
    assert summary.completion_percentage == 100.0 # Formula handles total_sap == 0 as 100%

    # Non-empty SAP, empty KRA
    sap_inv = Invoice(
        pin="P1", partner_name="Cust1", invoice_number="INV1",
        invoice_date=date(2026, 3, 1), cu_number="CU1", vat_group="16",
        base_amount=Decimal("100.00"), source=InvoiceSource.SAP
    )
    summary, results = reconciliation_service.reconcile_invoices([sap_inv], [])
    assert summary.total_sap == 1
    assert summary.total_kra == 0
    assert summary.matches == 0
    assert summary.missing_in_kra == 1
    assert summary.completion_percentage == 0.0


# --- Endpoints Integration Tests ---

def test_compare_flow_unauthenticated(client):
    response = client.post("/api/v1/reconciliation/compare", json={"session_id": "dummy-uuid"})
    assert response.status_code == 401


def test_compare_flow_success(client, auth_headers):
    # 1. Load SAP invoices
    load_res = client.get("/api/v1/sales?from=2026-03-01&to=2026-03-30", headers=auth_headers)
    assert load_res.status_code == 200
    session_id = load_res.json()["session_id"]
    
    # 2. Upload KRA CSV
    csv_content = (
        b"Pin Number,Customer Name,Invoice Number,Invoice Date,CU Number,VAT Group,Base Amount\n"
        b"P051393568M,Autoports Freight Terminals Limited,IN1080,02/03/2026,|0190439340000000455,16,1118894.84\n"
        b"P051137818X,GRAIN INDUSTRIES LIMITED,IN1081,11/03/2026,|0190439340000000456,16,3977701.88\n"
    )
    files = {"file": ("SEC_B.csv", csv_content, "text/csv")}
    upload_res = client.post(f"/api/v1/sales/upload?session_id={session_id}", headers=auth_headers, files=files)
    assert upload_res.status_code == 200

    # 3. Call Compare
    compare_res = client.post(
        "/api/v1/reconciliation/compare",
        headers=auth_headers,
        json={"session_id": session_id}
    )
    assert compare_res.status_code == 200
    data = compare_res.json()
    assert data["session_id"] == session_id
    assert data["summary"]["total_sap"] == 5
    assert data["summary"]["total_kra"] == 2
    # Verify matches
    assert data["summary"]["matches"] == 2
    # Verify that completion percentages are calculated
    assert data["summary"]["match_percentage"] > 0
    assert data["summary"]["completion_percentage"] == 40.0 # 2 matches / 5 sap = 40.0%

    # 4. Fetch compare again (should serve from cache)
    compare_res_cached = client.post(
        "/api/v1/reconciliation/compare",
        headers=auth_headers,
        json={"session_id": session_id}
    )
    assert compare_res_cached.status_code == 200
    assert compare_res_cached.json() == data


def test_compare_flow_missing_kra_upload(client, auth_headers):
    # 1. Load SAP invoices
    load_res = client.get("/api/v1/sales?from=2026-03-01&to=2026-03-30", headers=auth_headers)
    session_id = load_res.json()["session_id"]
    
    # 2. Call compare immediately (should fail because KRA isn't uploaded yet)
    compare_res = client.post(
        "/api/v1/reconciliation/compare",
        headers=auth_headers,
        json={"session_id": session_id}
    )
    assert compare_res.status_code == 400
    assert "KRA CSV upload is required" in compare_res.json()["detail"]


def test_compare_flow_expired_session(client, auth_headers, db_session):
    # 1. Load SAP invoices
    load_res = client.get("/api/v1/sales?from=2026-03-01&to=2026-03-30", headers=auth_headers)
    session_id = load_res.json()["session_id"]
    
    # 2. Manually alter the session last_accessed_at in the database to expire it
    from datetime import datetime, timedelta, timezone
    from app.models.reconciliation_session import ReconciliationSession
    
    session = db_session.query(ReconciliationSession).filter(ReconciliationSession.id == session_id).first()
    session.last_accessed_at = datetime.now(timezone.utc) - timedelta(minutes=31)
    db_session.commit()
    
    # 3. Call compare (should fail with session expired)
    compare_res = client.post(
        "/api/v1/reconciliation/compare",
        headers=auth_headers,
        json={"session_id": session_id}
    )
    assert compare_res.status_code == 400
    assert "Session has expired" in compare_res.json()["detail"]
