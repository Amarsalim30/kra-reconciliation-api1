import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.database.database import get_db
from app.main import app
from app.models.user import User
from app.core.security import hash_password
from app.models.sap_field_mapping import (
    SAPFieldMapping,
    VatModule,
    InternalField,
    SourceType,
    TransformationType,
)
from app.services.sap_field_extractor import (
    extract_and_validate_field,
    TRANSFORMATION_REGISTRY,
)
from app.services.settings_service import SettingsService

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_sap_mapping_db.db"
if os.path.exists("./test_sap_mapping_db.db"):
    try:
        os.remove("./test_sap_mapping_db.db")
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
            username="sap_tester",
            email="sap@example.com",
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


def test_transformation_classes():
    # NONE
    assert TRANSFORMATION_REGISTRY[TransformationType.NONE].transform("hello") == "hello"

    # BEFORE_SLASH
    assert TRANSFORMATION_REGISTRY[TransformationType.BEFORE_SLASH].transform("KRA123/456") == "KRA123"
    assert TRANSFORMATION_REGISTRY[TransformationType.BEFORE_SLASH].transform("KRA123") == "KRA123"

    # AFTER_SLASH
    assert TRANSFORMATION_REGISTRY[TransformationType.AFTER_SLASH].transform("KRA123/456") == "456"
    assert TRANSFORMATION_REGISTRY[TransformationType.AFTER_SLASH].transform("KRA123") == ""

    # REGEX
    assert TRANSFORMATION_REGISTRY[TransformationType.REGEX].transform("Invoice-12345", r"Invoice-(\d+)") == "12345"
    assert TRANSFORMATION_REGISTRY[TransformationType.REGEX].transform("Invoice-12345", r"Order-(\d+)") == ""

    # REGEX_REPLACE
    assert TRANSFORMATION_REGISTRY[TransformationType.REGEX_REPLACE].transform("A B C", r"\s+") == "ABC" # no pipe defaults to empty string replacement
    assert TRANSFORMATION_REGISTRY[TransformationType.REGEX_REPLACE].transform("A B C", r"\s+|D") == "ADBDC" # replace space with D
    assert TRANSFORMATION_REGISTRY[TransformationType.REGEX_REPLACE].transform("A B C", r"\s+|") == "ABC" # remove spaces
    assert TRANSFORMATION_REGISTRY[TransformationType.REGEX_REPLACE].transform("A-B-C", r"-|/") == "A/B/C"


    # TRIM
    assert TRANSFORMATION_REGISTRY[TransformationType.TRIM].transform("  spaces  ") == "spaces"

    # CASE SENSITIVITY
    assert TRANSFORMATION_REGISTRY[TransformationType.UPPERCASE].transform("low") == "LOW"
    assert TRANSFORMATION_REGISTRY[TransformationType.LOWERCASE].transform("HIGH") == "high"


def test_field_extractor_pipeline():
    rules = [
        SAPFieldMapping(
            module=VatModule.PURCHASES,
            internal_field=InternalField.CU_NUMBER,
            source_type=SourceType.HEADER,
            priority=1,
            sap_field="NumAtCard",
            transformation=TransformationType.AFTER_SLASH,
            is_enabled=True,
        ),
        SAPFieldMapping(
            module=VatModule.PURCHASES,
            internal_field=InternalField.CU_NUMBER,
            source_type=SourceType.HEADER,
            priority=2,
            sap_field="U_CUINV",
            transformation=TransformationType.NONE,
            validation_regex="^[0-9]+$",
            is_enabled=True,
        ),
    ]

    # Test priority fallback: Priority 1 is empty -> falls back to Priority 2
    document = {
        "NumAtCard": "",
        "U_CUINV": "002200318"
    }

    res = extract_and_validate_field(document, None, InternalField.CU_NUMBER, rules)
    assert res.value == "002200318"
    assert len(res.diagnostics) == 2
    assert res.diagnostics[0].status == "empty"
    assert res.diagnostics[1].status == "found"

    # Test validation regex fail warning
    document_invalid = {
        "NumAtCard": "",
        "U_CUINV": "INVALID_CU"
    }
    res_invalid = extract_and_validate_field(document_invalid, None, InternalField.CU_NUMBER, rules)
    assert res_invalid.value == "INVALID_CU"
    assert len(res_invalid.warnings) == 1
    assert "failed validation regex" in res_invalid.warnings[0]


def test_sap_field_mappings_endpoints(client: TestClient, db_session):
    # Register default system settings first to avoid missing rows
    SettingsService.get_or_create_system_settings(db_session)

    # Login to get JWT
    login_res = client.post("/api/v1/auth/login", json={"username": "sap_tester", "password": "securepass123"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET (Should return seeded default mappings)
    get_res = client.get("/api/v1/settings/sap-field-mappings", headers=headers)
    assert get_res.status_code == 200
    mappings = get_res.json()
    assert len(mappings) > 0
    assert any(m["internal_field"] == "cu_number" for m in mappings)

    # 2. POST Preview mapping execution
    sample_doc = {
        "DocNum": 999,
        "CardName": "Partner XYZ",
        "FederalTaxID": "P05112",
        "DocDate": "2026-03-02",
        "U_CUINV": "KRA12345/6789",
        "NumAtCard": "KRA12345/6789",
        "DocumentLines": [
            {"LineTotal": 25000.00, "VatGroup": "I1"}
        ]
    }
    preview_res = client.post(
        "/api/v1/settings/sap-field-mappings/preview",
        json={"sample_document": sample_doc},
        headers=headers
    )
    assert preview_res.status_code == 200
    preview_data = preview_res.json()
    assert "mapped_values" in preview_data
    assert preview_data["mapped_values"]["invoice_number"]["value"] == "999"
    assert preview_data["mapped_values"]["partner_name"]["value"] == "Partner XYZ"
    assert preview_data["mapped_values"]["cu_number"]["value"] == "KRA12345/6789"
