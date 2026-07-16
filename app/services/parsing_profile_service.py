from typing import Dict, Optional
from sqlalchemy.orm import Session
from app.models.settings import SystemSetting
from app.schemas.settings import KRAParsingProfileItem, KRAParsingProfilesConfig

class ParsingProfileError(Exception):
    pass

# NOTE: Column indexes below follow the documented standard KRA ETIMS export layout.
# They are best-guess defaults — VERIFY against a real KRA export before relying on them.
DEFAULT_PARSING_PROFILES: Dict[str, KRAParsingProfileItem] = {
    "SEC_B": KRAParsingProfileItem(
        pin_column=0, partner_name_column=1, invoice_number_column=2,
        invoice_date_column=3, cu_number_column=4, base_amount_column=6
    ),
    "SEC_F": KRAParsingProfileItem(
        pin_column=1, partner_name_column=2, invoice_number_column=None,
        invoice_date_column=3, cu_number_column=4, base_amount_column=7
    ),
    "SEC_G": KRAParsingProfileItem(
        pin_column=1, partner_name_column=2, invoice_number_column=None,
        invoice_date_column=3, cu_number_column=4, base_amount_column=7
    ),
    "SEC_H": KRAParsingProfileItem(
        pin_column=1, partner_name_column=2, invoice_number_column=None,
        invoice_date_column=3, cu_number_column=4, base_amount_column=8
    ),
    "SEC_I": KRAParsingProfileItem(
        pin_column=1, partner_name_column=2, invoice_number_column=None,
        invoice_date_column=3, cu_number_column=4, base_amount_column=7
    ),
}

class ParsingProfileService:
    _cached_profiles: Optional[KRAParsingProfilesConfig] = None
    _cached_version: int = 0

    @classmethod
    def get_profiles(cls, db: Session) -> KRAParsingProfilesConfig:
        """Fetches the parsing profiles from SystemSettings, using an in-memory cache based on the system setting version."""
        from app.services.settings_service import SettingsService
        setting = SettingsService.get_or_create_system_settings(db)

        # If cache is valid, return it
        if cls._cached_profiles and cls._cached_version == setting.version:
            return cls._cached_profiles

        # Fallback to defaults if empty
        if not setting.kra_parsing_profiles:
            defaults = cls._get_default_profiles()
            # We don't save it to DB here to avoid transaction side-effects during read.
            # It will be saved if the user updates settings.
            cls._cached_profiles = KRAParsingProfilesConfig(profiles=defaults)
        else:
            try:
                cls._cached_profiles = KRAParsingProfilesConfig(**setting.kra_parsing_profiles)
            except Exception as e:
                raise ParsingProfileError(f"Failed to parse KRA parsing profiles JSON: {e}")

        cls._cached_version = setting.version
        return cls._cached_profiles

    @classmethod
    def get_required_profile(cls, db: Session, section_prefix: str) -> KRAParsingProfileItem:
        """Looks up the parsing profile for a specific section (e.g., 'SEC_B')."""
        config = cls.get_profiles(db)
        prefix_upper = section_prefix.strip().upper()
        if prefix_upper not in config.profiles:
            raise ParsingProfileError(f"Unknown KRA section '{prefix_upper}'. Configure a parsing profile before importing this file.")
        return config.profiles[prefix_upper]

    @classmethod
    def _get_default_profiles(cls) -> Dict[str, KRAParsingProfileItem]:
        return dict(DEFAULT_PARSING_PROFILES)

    @classmethod
    def seed_default_profiles(cls, db: Session) -> None:
        """Idempotently persist the default KRA parsing profiles into system_settings.

        Only fills the column when empty; never overwrites operator-customized values.
        """
        from app.services.settings_service import SettingsService
        setting = SettingsService.get_or_create_system_settings(db)
        if setting.kra_parsing_profiles:
            return
        config = KRAParsingProfilesConfig(
            schema_version=1,
            profiles={k: v.model_dump() for k, v in DEFAULT_PARSING_PROFILES.items()},
        )
        setting.kra_parsing_profiles = config.model_dump()
        setting.version += 1
        db.commit()
