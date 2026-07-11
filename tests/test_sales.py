import pytest
from datetime import date
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.database.database import get_db
from app.main import app
from app.services.normalization import normalize_invoice_data
from app.services import invoice_service, kra_service
from app.schemas.invoice import Invoice

# Setup test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_sales_db.db"
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
    # Register and login to get auth token
    register_payload = {
        "username": "sales_tester",
        "password": "securepassword123",
        "email": "sales_tester@example.com",
    }
    client.post("/api/v1/auth/register", json=register_payload)

    login_payload = {
        "username": "sales_tester",
        "password": "securepassword123",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# --- Normalization Tests ---

def test_normalization_success():
    res = normalize_invoice_data(
        pin="  P051393568M  ",
        partner_name="  Autoports Freight Terminals Limited  ",
        invoice_number="  IN1080  ",
        invoice_date="02/03/2026",
        cu_number="  |0190439340000000455  ",
        vat_group="16.0",
        base_amount=" 1118894.84 "
    )
    assert res["pin"] == "P051393568M"
    assert res["partner_name"] == "Autoports Freight Terminals Limited"
    assert res["invoice_number"] == "IN1080"
    assert res["invoice_date"] == date(2026, 3, 2)
    assert res["cu_number"] == "0190439340000000455"
    assert res["vat_group"] == "16"
    assert res["base_amount"] == Decimal("1118894.84")


def test_normalization_iso_date_success():
    res = normalize_invoice_data(
        pin="P051393568M",
        partner_name="Autoports",
        invoice_number="IN1080",
        invoice_date="2026-03-02",
        cu_number="|0190439340000000455",
        vat_group=16,
        base_amount=1118894.84
    )
    assert res["invoice_date"] == date(2026, 3, 2)
    assert res["vat_group"] == "16"


def test_normalization_missing_fields():
    # Customer name is required
    with pytest.raises(ValueError, match="Customer Name is required"):
        normalize_invoice_data("PIN123", None, "IN1080", "2026-03-02", "CU123", "16", 100)

    # Invoice Date is required
    with pytest.raises(ValueError, match="Invoice Date is required"):
        normalize_invoice_data("PIN123", "Autoports", "IN1080", None, "CU123", "16", 100)

    # PIN and CU number are optional, default to empty string
    res = normalize_invoice_data(None, "Autoports", "IN1080", "2026-03-02", None, "16", 100)
    assert res["pin"] == ""
    assert res["cu_number"] == ""


def test_normalization_invalid_types():
    with pytest.raises(ValueError, match="Invalid date format"):
        normalize_invoice_data("PIN123", "Autoports", "IN1080", "invalid-date", "CU123", "16", 100)

    with pytest.raises(ValueError, match="VAT Group is required"):
        normalize_invoice_data("PIN123", "Autoports", "IN1080", "2026-03-02", "CU123", "", 100)

    with pytest.raises(ValueError, match="Invalid Base Amount"):
        normalize_invoice_data("PIN123", "Autoports", "IN1080", "2026-03-02", "CU123", "16", "one-thousand")

    with pytest.raises(ValueError, match="Must be greater than zero"):
        normalize_invoice_data("PIN123", "Autoports", "IN1080", "2026-03-02", "CU123", "16", -50)


# --- Service Tests ---

def test_invoice_service_date_range_filtering():
    # March 1st to March 30th 2026
    invoices = invoice_service.get_invoices(date(2026, 3, 1), date(2026, 3, 30))
    assert len(invoices) == 5
    # Verify April invoice is not returned
    for inv in invoices:
        assert date(2026, 3, 1) <= inv.invoice_date <= date(2026, 3, 30)
        assert not inv.cu_number.startswith("|")
        assert type(inv.base_amount) is Decimal


# --- CSV Ingestion Tests ---

def test_parse_kra_csv_mock_class():
    class MockUploadFile:
        def __init__(self, filename, content):
            self.filename = filename
            self.file = io.BytesIO(content)

    import io
    content = (
        b"Pin Number,Customer Name,Invoice Number,Invoice Date,CU Number,VAT Group,Base Amount\n"
        b"P051393568M,Autoports,IN1080,02/03/2026,|0190439340000000455,16,1118894.84\n"
        b"P051137818X,GRAIN LTD,IN1081,11/03/2026,|0190439340000000456,16,3977701.88\n"
    )
    mock_file = MockUploadFile("SEC_B.csv", content)
    
    response = kra_service.parse_kra_csv(mock_file)
    assert response.filename == "SEC_B.csv"
    assert response.rows == 2
    assert response.parsed == 2
    assert response.errors_count == 0
    assert len(response.invoices) == 2
    assert response.invoices[0].invoice_number == "IN1080"
    assert response.invoices[0].cu_number == "0190439340000000455"


def test_parse_kra_csv_aggregate_errors():
    class MockUploadFile:
        def __init__(self, filename, content):
            self.filename = filename
            self.file = io.BytesIO(content)

    import io
    content = (
        b"Pin Number,Customer Name,Invoice Number,Invoice Date,CU Number,VAT Group,Base Amount\n"
        b"P051393568M,Autoports,IN1080,invalid-date,|0190439340000000455,16,1118894.84\n"
        b"P051137818X,GRAIN LTD,IN1081,11/03/2026,|0190439340000000456,,3977701.88\n" # Missing VAT Group
        b"P051137818X,GRAIN LTD,IN1080,11/03/2026,|0190439340000000456,16,3977701.88\n" # Duplicate Invoice Number IN1080
    )
    mock_file = MockUploadFile("SEC_B_errors.csv", content)
    
    response = kra_service.parse_kra_csv(mock_file)
    assert response.rows == 3
    assert response.parsed == 1
    assert response.errors_count == 2
    
    assert response.errors[0].row == 2
    assert "Invoice Date" in response.errors[0].column
    assert "Invalid date format" in response.errors[0].message
    
    assert response.errors[1].row == 3
    assert "VAT Group" in response.errors[1].column
    assert "VAT Group is required" in response.errors[1].message


# --- Endpoint Integration Tests ---

def test_get_sales_unauthenticated(client):
    response = client.get("/api/v1/sales?from=2026-03-01&to=2026-03-30")
    assert response.status_code == 401


def test_get_sales_success(client, auth_headers):
    response = client.get("/api/v1/sales?from=2026-03-01&to=2026-03-30", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "SAP"
    assert data["count"] == 5
    assert len(data["invoices"]) == 5
    assert data["invoices"][0]["invoice_number"] == "1080"
    assert data["invoices"][0]["cu_number"] == "0190439340000000455"



def test_upload_sales_unauthenticated(client):
    files = {"file": ("test.csv", b"some-csv-data", "text/csv")}
    response = client.post("/api/v1/sales/upload?session_id=dummy-id", files=files)
    assert response.status_code == 401


def test_upload_sales_success(client, auth_headers):
    # 1. Fetch sales first to generate active session
    get_res = client.get("/api/v1/sales?from=2026-03-01&to=2026-03-30", headers=auth_headers)
    session_id = get_res.json()["session_id"]

    content = (
        b"Pin Number,Customer Name,Invoice Number,Invoice Date,CU Number,VAT Group,Base Amount\n"
        b"P051393568M,Autoports Freight Terminals Limited,IN1080,02/03/2026,|0190439340000000455,16,1118894.84\n"
    )
    files = {"file": ("SEC_B.csv", content, "text/csv")}
    response = client.post(f"/api/v1/sales/upload?session_id={session_id}", headers=auth_headers, files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == session_id
    assert data["filename"] == "SEC_B.csv"
    assert data["rows"] == 1
    assert data["parsed"] == 1
    assert data["errors_count"] == 0
    assert len(data["invoices"]) == 1
    assert data["invoices"][0]["invoice_number"] == "IN1080"
    assert data["invoices"][0]["cu_number"] == "0190439340000000455"
    assert data["invoices"][0]["base_amount"] == 1118894.84


def test_upload_sales_invalid_file_extension(client, auth_headers):
    get_res = client.get("/api/v1/sales?from=2026-03-01&to=2026-03-30", headers=auth_headers)
    session_id = get_res.json()["session_id"]

    files = {"file": ("SEC_B.txt", b"some-text", "text/plain")}
    response = client.post(f"/api/v1/sales/upload?session_id={session_id}", headers=auth_headers, files=files)
    assert response.status_code == 400
    assert "Only CSV files are allowed" in response.json()["detail"]


def test_upload_sales_empty_file(client, auth_headers):
    get_res = client.get("/api/v1/sales?from=2026-03-01&to=2026-03-30", headers=auth_headers)
    session_id = get_res.json()["session_id"]

    files = {"file": ("SEC_B.csv", b"", "text/csv")}
    response = client.post(f"/api/v1/sales/upload?session_id={session_id}", headers=auth_headers, files=files)
    assert response.status_code == 400
    assert "Uploaded file is empty" in response.json()["detail"]
