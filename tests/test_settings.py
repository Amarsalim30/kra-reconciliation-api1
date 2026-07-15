import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.database.database import get_db
from app.main import app
from app.models.user import User
from app.core.security import hash_password

import os
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_settings_db.db"
if os.path.exists("./test_settings_db.db"):
    try:
        os.remove("./test_settings_db.db")
    except Exception:
        pass

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="db_session", scope="function")
def fixture_db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Seed test user
        user = User(
            username="admin_tester",
            email="admin@example.com",
            password_hash=hash_password("securepass123"),
            is_active=True,
            role="admin",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
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


def test_get_and_update_settings(client: TestClient, db_session):
    # Login to get JWT
    login_res = client.post("/api/v1/auth/login", json={"username": "admin_tester", "password": "securepass123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET settings
    response = client.get("/api/v1/settings", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "system_settings" in data
    assert data["system_settings"]["amount_tolerance"] == "10.00"

    # 2. Update Reconciliation Settings
    sys_settings = data["system_settings"]

    sys_update_payload = {
        "amount_tolerance": "15.50",
        "date_tolerance": 5,
        "partner_similarity_threshold": 0.90,
        "version": sys_settings["version"],
        "reason": "Test tolerance update to 15.50 and 5 days",
    }
    update_res = client.put("/api/v1/settings/reconciliation", json=sys_update_payload, headers=headers)
    assert update_res.status_code == 200
    updated_sys = update_res.json()
    assert updated_sys["amount_tolerance"] == "15.50"
    assert updated_sys["date_tolerance"] == 5
    assert updated_sys["partner_similarity_threshold"] == 0.90
    assert updated_sys["version"] == sys_settings["version"] + 1

    # 3. Update SAP Connection
    sap_payload = {
        "name": "Test Enterprise SAP Connection",
        "base_url": "https://sap.test.company.com:50000/b1s/v1",
        "company_db": "TEST_DB_KE",
        "username": "manager",
        "password": "SecretPassword123!",
        "verify_ssl": False,
        "version": 1,
    }
    sap_res = client.put("/api/v1/settings/connection", json=sap_payload, headers=headers)
    assert sap_res.status_code == 200
    updated_sap = sap_res.json()
    assert updated_sap["company_db"] == "TEST_DB_KE"
    assert updated_sap["password_set"] is True

    # 4. Save Tax Mappings
    curr_tax = client.get("/api/v1/settings/tax", headers=headers).json()
    existing_mappings = curr_tax.get("vat_mappings", [])
    
    updated_mappings_list = list(existing_mappings)
    updated_mappings_list.append({
        "module": "sales",
        "sap_code": "CUSTOM1",
        "description": "Custom Reduced Rate",
        "vat_bucket_code": "REDUCED",
        "is_builtin": False,
    })

    conn_id = updated_sap["id"]
    vat_payload = {
        "connection_id": conn_id,
        "reason": "Add custom VAT mapping",
        "mappings": updated_mappings_list,
    }
    vat_res = client.put("/api/v1/settings/tax", json=vat_payload, headers=headers)
    assert vat_res.status_code == 200
    tax_data = vat_res.json()
    assert len(tax_data["vat_mappings"]) == len(existing_mappings) + 1

    # 5. Check Audit Logs
    audit_res = client.get("/api/v1/settings/audit", headers=headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) >= 3
