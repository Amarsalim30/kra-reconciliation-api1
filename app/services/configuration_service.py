from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.settings import (
    ConfigExportPayload,
    ImportValidationSummary,
    SAPConnectionResponse,
    SAPConnectionUpdate,
    SettingAuditLogResponse,
    SettingsCompositeResponse,
    SystemSettingsResponse,
    SystemSettingsUpdate,
    TaxConfigurationResponse,
    TaxConfigurationUpdatePayload,
    TestConnectionRequest,
    TestConnectionResponse,
)
from app.services.configuration_health_service import ConfigurationHealthService
from app.services.configuration_validator import ConfigurationValidator
from app.services.settings_service import SettingsService


class ConfigurationService:
    """
    High-level orchestrator for configuration operations. Coordinates settings persistence,
    pre-save validation rules, System Doctor diagnostics, and transactional imports.
    """

    def __init__(self, db: Session):
        self.db = db
        self.settings_service = SettingsService()

    def get_composite_overview(self) -> SettingsCompositeResponse:
        return self.settings_service.get_composite_settings(self.db)

    def get_sap_connection(self) -> Optional[SAPConnectionResponse]:
        sys = self.settings_service.get_or_create_system_settings(self.db)
        conn = self.settings_service.get_active_connection(self.db, sys)
        return SAPConnectionResponse.model_validate(conn) if conn else None

    def update_sap_connection(self, payload: SAPConnectionUpdate, current_user: Optional[User] = None) -> SAPConnectionResponse:
        return self.settings_service.save_or_update_sap_connection(self.db, payload, current_user)

    def test_sap_connection(self, payload: TestConnectionRequest) -> TestConnectionResponse:
        return self.settings_service.test_sap_connection(self.db, payload)

    def get_reconciliation_rules(self) -> SystemSettingsResponse:
        sys = self.settings_service.get_or_create_system_settings(self.db)
        return SystemSettingsResponse.model_validate(sys)

    def update_reconciliation_rules(self, payload: SystemSettingsUpdate, current_user: Optional[User] = None) -> SystemSettingsResponse:
        return self.settings_service.update_system_settings(self.db, payload, current_user)

    def get_tax_configuration(self) -> TaxConfigurationResponse:
        sys = self.settings_service.get_or_create_system_settings(self.db)
        active_conn = self.settings_service.get_active_connection(self.db, sys)
        return self.settings_service.get_tax_configuration(self.db, active_conn.id if active_conn else None)

    def update_tax_configuration(self, payload: TaxConfigurationUpdatePayload, current_user: Optional[User] = None) -> TaxConfigurationResponse:
        return self.settings_service.save_tax_configuration(self.db, payload, current_user)

    def get_diagnostics(self) -> Dict[str, Any]:
        doctor = ConfigurationHealthService(self.db)
        return doctor.check_health()

    def export_config(self) -> ConfigExportPayload:
        return self.settings_service.export_configuration(self.db)

    def import_config(self, json_data: Dict[str, Any], dry_run: bool = False, current_user: Optional[User] = None) -> ImportValidationSummary:
        return self.settings_service.import_configuration(self.db, json_data, dry_run=dry_run, current_user=current_user)

    def restore_defaults(self, scope: str = "all", current_user: Optional[User] = None) -> Dict[str, Any]:
        return self.settings_service.restore_defaults(self.db, scope=scope, current_user=current_user)

    def get_audit_logs(self, limit: int = 50) -> List[SettingAuditLogResponse]:
        logs = self.settings_service.get_audit_logs(self.db, limit=limit)
        return [SettingAuditLogResponse.model_validate(l) for l in logs]
