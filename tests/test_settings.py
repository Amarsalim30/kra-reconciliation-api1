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

    # 2. Update System Settings (including KRA section mappings)
    sys_settings = data["system_settings"]
    kra_mappings = sys_settings.get("kra_section_mappings") or {}
    
    # Modify one of the KRA Section mappings to test update persistence
    if "SEC_B" in kra_mappings:
        kra_mappings["SEC_B"]["display_name"] = "Modified SEC_B Sales CSV"

    sys_update_payload = {
        "amount_tolerance": "15.50",
        "base_amount_policy": "treat_as_zero",
        "unmapped_vat_policy": "needs_review",
        "ignore_missing_cu": True,
        "include_credit_notes": True,
        "include_debit_notes": True,
        "skip_cancelled": True,
        "kra_section_mappings": kra_mappings,
        "version": sys_settings["version"],
        "reason": "Test tolerance update to 15.50 and KRA mapping change",
    }
    update_res = client.put("/api/v1/settings/system-settings", json=sys_update_payload, headers=headers)
    assert update_res.status_code == 200
    updated_sys = update_res.json()
    assert updated_sys["amount_tolerance"] == "15.50"
    assert updated_sys["base_amount_policy"] == "treat_as_zero"
    assert updated_sys["kra_section_mappings"]["SEC_B"]["display_name"] == "Modified SEC_B Sales CSV"
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
    sap_res = client.put("/api/v1/settings/sap-connection", json=sap_payload, headers=headers)
    assert sap_res.status_code == 200
    updated_sap = sap_res.json()
    assert updated_sap["company_db"] == "TEST_DB_KE"
    assert updated_sap["password_set"] is True

    # 4. Save VAT Mappings
    curr_settings = client.get("/api/v1/settings", headers=headers).json()
    existing_mappings = curr_settings.get("vat_mappings", [])
    
    updated_mappings_list = list(existing_mappings)
    updated_mappings_list.append({
        "module": "sales",
        "sap_code": "CUSTOM1",
        "description": "Custom Reduced Rate",
        "canonical_value": "VAT_8",
        "is_builtin": False,
    })

    conn_id = updated_sap["id"]
    vat_payload = {
        "connection_id": conn_id,
        "reason": "Add custom VAT mapping",
        "mappings": updated_mappings_list,
    }
    vat_res = client.put("/api/v1/settings/vat-mappings", json=vat_payload, headers=headers)
    assert vat_res.status_code == 200
    vat_data = vat_res.json()
    assert len(vat_data) == len(existing_mappings) + 1

    # 5. Check Audit Logs
    audit_res = client.get("/api/v1/settings/audit-logs", headers=headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) >= 3


def test_resolve_filename_to_section_module_boundaries(client: TestClient, db_session):
    from app.services.kra_service import resolve_filename_to_section
    from app.services.settings_service import SettingsService
    from app.models.settings import VatModule

    system_settings = SettingsService.get_or_create_system_settings(db_session)
    mappings = system_settings.kra_section_mappings or {}

    # Test Sales resolution:
    # 1. SEC_B_WITH_VAT_PIN1.CSV should resolve to SEC_B
    sec_id, config = resolve_filename_to_section("SEC_B_WITH_VAT_PIN1.CSV", mappings, VatModule.SALES)
    assert sec_id == "SEC_B"
    assert config["module"] == "sales"

    # 2. SEC_B_WITH_VAT_PIN1.CSV should NOT resolve in Purchases module
    sec_id, config = resolve_filename_to_section("SEC_B_WITH_VAT_PIN1.CSV", mappings, VatModule.PURCHASES)
    assert sec_id is None

    # 3. SEC_B_WITHOUT_PIN_AND_NON-VAT_PIN1.CSV should NOT resolve to anything (excluded by regex)
    sec_id, config = resolve_filename_to_section("SEC_B_WITHOUT_PIN_AND_NON-VAT_PIN1.CSV", mappings, VatModule.SALES)
    assert sec_id is None

    # Test Purchases resolution:
    # 4. SEC_F_WITH_VAT_PIN1.CSV should resolve to SEC_F
    sec_id, config = resolve_filename_to_section("SEC_F_WITH_VAT_PIN1.CSV", mappings, VatModule.PURCHASES)
    assert sec_id == "SEC_F"
    assert config["module"] == "purchases"

    # 5. SEC_F_WITH_VAT_PIN1.CSV should NOT resolve in Sales module
    sec_id, config = resolve_filename_to_section("SEC_F_WITH_VAT_PIN1.CSV", mappings, VatModule.SALES)
    assert sec_id is None

    # 6. SEC_G_WITH_VAT_PIN1.CSV should resolve to SEC_G
    sec_id, config = resolve_filename_to_section("SEC_G_WITH_VAT_PIN1.CSV", mappings, VatModule.PURCHASES)
    assert sec_id == "SEC_G"
    assert config["module"] == "purchases"

