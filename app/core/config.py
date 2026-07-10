from enum import Enum
from functools import lru_cache
from pathlib import Path

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.exceptions import SAPConfigurationError


class BaseAmountPolicy(str, Enum):
    SKIP = "skip"
    REJECT = "reject"
    ALLOW = "allow"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    app_name: str = Field(default="KRA Reconciliation API", alias="APP_NAME")
    app_version: str = Field(default="1.0.0", alias="APP_VERSION")
    database_url: str = Field(default=..., alias="DATABASE_URL")
    secret_key: SecretStr = Field(default=..., alias="SECRET_KEY")
    algorithm: str = Field(default="HS256", alias="ALGORITHM")
    access_token_expire_minutes: int = Field(default=30, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")

    sap_base_url: AnyHttpUrl | None = Field(default=None, alias="SAP_BASE_URL")
    sap_username: str = Field(default="", alias="SAP_USERNAME")
    sap_password: SecretStr = Field(default=SecretStr(""), alias="SAP_PASSWORD")
    sap_company_db: str = Field(default="", alias="SAP_COMPANY_DB")
    sap_verify_ssl: bool = Field(default=True, alias="SAP_VERIFY_SSL")
    sap_base_amount_policy: BaseAmountPolicy = Field(default=BaseAmountPolicy.SKIP, alias="SAP_BASE_AMOUNT_POLICY")

    max_upload_size_mb: int = Field(default=5, alias="MAX_UPLOAD_SIZE_MB")
    kra_header_mapping: dict[str, str] = Field(
        default={
            "pin number": "pin",
            "pin": "pin",
            "customer name": "customer_name",
            "invoice number": "invoice_number",
            "invoice date": "invoice_date",
            "cu number": "cu_number",
            "vat group": "vat_group",
            "base amount": "base_amount"
        },
        alias="KRA_HEADER_MAPPING"
    )

    @field_validator("sap_base_url", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: object) -> object:
        if v == "":
            return None
        return v

    @model_validator(mode="after")
    def validate_sap_config(self) -> "Settings":
        if self.sap_base_url:
            missing = []
            if not self.sap_username:
                missing.append("SAP_USERNAME")
            if not self.sap_password.get_secret_value():
                missing.append("SAP_PASSWORD")
            if not self.sap_company_db:
                missing.append("SAP_COMPANY_DB")
            if missing:
                raise SAPConfigurationError(
                    f"Invalid SAP Service Layer configuration. Missing required fields: {', '.join(missing)}"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

