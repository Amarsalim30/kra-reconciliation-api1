from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    APP_NAME: str = "KRA Reconciliation API"
    APP_VERSION: str = "1.0.0"
    DATABASE_URL: str = ""
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    SAP_BASE_URL: str = ""
    SAP_USERNAME: str = ""
    SAP_PASSWORD: str = ""
    SAP_COMPANY_DB: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
