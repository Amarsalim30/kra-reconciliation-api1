from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ConfigValidationError(Exception):
    """Raised when configuration validation rules are violated."""
    pass


class ConfigurationValidator:
    """
    Dedicated validation service for configuration rules, import payloads, bounds, and tax mapping consistency.
    """

    SUPPORTED_SCHEMA_VERSION = 2
    SUPPORTED_APPLICATION = "KRA Reconciliation System"

    @classmethod
    def validate_amount_tolerance(cls, val: Decimal) -> Decimal:
        if val < Decimal("0.00"):
            raise ConfigValidationError("Amount tolerance (KES) cannot be negative.")
        return val

    @classmethod
    def validate_date_tolerance(cls, val: int) -> int:
        if val < 0:
            raise ConfigValidationError("Date tolerance (days) cannot be negative.")
        return val

    @classmethod
    def validate_partner_similarity(cls, val: float) -> float:
        if not (0.50 <= val <= 1.00):
            raise ConfigValidationError("Partner similarity threshold must be between 0.50 and 1.00.")
        return val

    @classmethod
    def validate_import_payload(cls, json_data: Dict[str, Any]) -> Dict[str, Any]:
        schema_version = json_data.get("schema_version")
        if schema_version != cls.SUPPORTED_SCHEMA_VERSION:
            raise ConfigValidationError(
                f"Unsupported configuration schema_version {schema_version}. Expected {cls.SUPPORTED_SCHEMA_VERSION}."
            )

        app_name = json_data.get("application")
        if app_name and app_name != cls.SUPPORTED_APPLICATION:
            raise ConfigValidationError(
                f"Invalid application config '{app_name}'. Expected '{cls.SUPPORTED_APPLICATION}'."
            )

        settings = json_data.get("settings")
        if not settings or not isinstance(settings, dict):
            raise ConfigValidationError("Import file is missing 'settings' object.")

        return json_data

    @classmethod
    def validate_sap_connection_data(cls, base_url: str, company_db: str, username: str) -> None:
        if not base_url or not base_url.strip():
            raise ConfigValidationError("SAP Base URL is required.")
        if not (base_url.startswith("http://") or base_url.startswith("https://")):
            raise ConfigValidationError("SAP Base URL must start with http:// or https://")
        if not company_db or not company_db.strip():
            raise ConfigValidationError("SAP Company DB is required.")
        if not username or not username.strip():
            raise ConfigValidationError("SAP Username is required.")
