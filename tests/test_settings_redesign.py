from decimal import Decimal
from datetime import date
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.database.base import Base
from app.models.settings import (
    KRASection,
    SAPConnection,
    SAPVatMapping,
    SystemSetting,
    VATBucket,
)
from app.models.user import User
from app.schemas.invoice import Invoice, InvoiceSource
from app.schemas.reconciliation import ReconciliationConfig
from app.schemas.settings import (
    SAPConnectionUpdate,
    SystemSettingsUpdate,
    TaxConfigurationUpdatePayload,
    SAPVatMappingItem,
)
from app.services.configuration_health_service import ConfigurationHealthService
from app.services.configuration_service import ConfigurationService
from app.services.configuration_validator import ConfigurationValidator, ConfigValidationError
from app.services.reconciliation_service import reconcile_invoices
from app.services.settings_cache import settings_cache
from app.services.settings_provider import SettingsProvider

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_settings_redesign_db.db"
if os.path.exists("./test_settings_redesign_db.db"):
    try:
        os.remove("./test_settings_redesign_db.db")
    except Exception:
        pass

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


def test_configuration_validator():
    # Bounds checks
    assert ConfigurationValidator.validate_amount_tolerance(Decimal("15.50")) == Decimal("15.50")
    with pytest.raises(ConfigValidationError):
        ConfigurationValidator.validate_amount_tolerance(Decimal("-1.00"))

    assert ConfigurationValidator.validate_date_tolerance(5) == 5
    with pytest.raises(ConfigValidationError):
        ConfigurationValidator.validate_date_tolerance(-2)

    assert ConfigurationValidator.validate_partner_similarity(0.85) == 0.85
    with pytest.raises(ConfigValidationError):
        ConfigurationValidator.validate_partner_similarity(0.30)

    # Import schema validation
    valid_payload = {
        "schema_version": 2,
        "application": "KRA Reconciliation System",
        "settings": {"amount_tolerance": "10.00"}
    }
    assert ConfigurationValidator.validate_import_payload(valid_payload) == valid_payload

    with pytest.raises(ConfigValidationError):
        ConfigurationValidator.validate_import_payload({"schema_version": 99})


def test_settings_provider_and_cache(db_session: Session):
    provider = SettingsProvider(db_session)
    config = provider.get_operational_config()

    assert "amount_tolerance" in config
    assert "date_tolerance" in config
    assert "partner_similarity_threshold" in config

    # Cache hit check
    assert provider.cache.get_cached(config["version"]) is not None

    # Invalidation
    provider.cache.invalidate()
    assert provider.cache.get_cached(config["version"]) is None


def test_configuration_health_service(db_session: Session):
    doctor = ConfigurationHealthService(db_session)
    report = doctor.check_health()

    assert "readiness" in report
    assert report["readiness"] in ("Ready", "Warning", "Blocked")
    assert isinstance(report["checks"], list)
    assert len(report["checks"]) > 0
    assert "coverage" in report


def test_reconciliation_service_with_custom_config():
    sap_inv = Invoice(
        pin="P051234567A",
        partner_name="ACME SUPPLIERS KENYA LTD",
        invoice_number="INV-2026-001",
        invoice_date=date(2026, 7, 10),
        cu_number="CU-12345678",
        vat_group="16",
        base_amount=Decimal("1000.00"),
        source=InvoiceSource.SAP
    )

    # KRA invoice with date variance of 2 days (within date tolerance of 3)
    kra_inv = Invoice(
        pin="P051234567A",
        partner_name="ACME SUPPLIERS KENYA",
        invoice_number="INV-2026-001",
        invoice_date=date(2026, 7, 12),
        cu_number="CU-12345678",
        vat_group="16",
        base_amount=Decimal("1005.00"),  # Variance 5.00 (within amount tolerance of 10.00)
        source=InvoiceSource.KRA
    )

    custom_config = ReconciliationConfig(
        amount_tolerance=Decimal("10.00"),
        date_tolerance=3,
        partner_similarity_threshold=0.80
    )

    summary, results = reconcile_invoices([sap_inv], [kra_inv], config=custom_config)

    assert summary.matches == 1
    assert summary.mismatches == 0
    assert len(results) == 1
    assert results[0].amount_match is True
    assert results[0].date_match is True


def test_configuration_service_orchestrator(db_session: Session):
    service = ConfigurationService(db_session)

    # Composite Overview
    composite = service.get_composite_overview()
    assert composite.system_settings is not None
    assert composite.tax_configuration is not None

    # Update reconciliation rules
    update_payload = SystemSettingsUpdate(
        amount_tolerance=Decimal("25.00"),
        date_tolerance=5,
        partner_similarity_threshold=0.90,
        version=composite.system_settings.version,
        reason="Updated unit test tolerances"
    )

    updated_sys = service.update_reconciliation_rules(update_payload)
    assert updated_sys.amount_tolerance == Decimal("25.00")
    assert updated_sys.date_tolerance == 5
    assert updated_sys.partner_similarity_threshold == 0.90

    # Diagnostics
    diag = service.get_diagnostics()
    assert diag["readiness"] in ("Ready", "Warning", "Blocked")

    # Export
    exported = service.export_config()
    assert exported.schema_version == 2

    # Import Dry Run
    import_result = service.import_config(exported.model_dump(mode="json"), dry_run=True)
    assert import_result.valid is True
