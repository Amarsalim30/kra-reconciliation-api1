from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.settings import SystemSetting, SAPConnection, SAPVatMapping, KRASection, VATBucket
from app.services.settings_cache import settings_cache, SettingsCache


class SettingsProvider:
    """
    Read-only provider for accessing system configuration parameters and tax mappings.
    Utilizes SettingsCache to avoid redundant database queries during matching operations.
    """

    def __init__(self, db: Session, cache: SettingsCache = settings_cache):
        self.db = db
        self.cache = cache

    def get_operational_config(self) -> Dict[str, Any]:
        sys_setting = self.db.query(SystemSetting).first()
        if not sys_setting:
            version = 1
        else:
            version = sys_setting.version

        cached = self.cache.get_cached(version)
        if cached is not None:
            return cached

        # Load from DB
        amount_tol = sys_setting.amount_tolerance if sys_setting else 10.00
        date_tol = sys_setting.date_tolerance if sys_setting else 3
        partner_thresh = sys_setting.partner_similarity_threshold if sys_setting else 0.85

        data = {
            "version": version,
            "amount_tolerance": float(amount_tol),
            "date_tolerance": int(date_tol),
            "partner_similarity_threshold": float(partner_thresh),
        }
        self.cache.set_cached(version, data)
        return data

    def get_vat_mappings(self, connection_id: Optional[int] = None) -> Dict[str, Dict[str, str]]:
        """
        Returns normalized VAT mappings split by module (purchases and sales):
        {'purchases': {'I1': '16', ...}, 'sales': {'O1': '16', ...}}
        """
        query = self.db.query(SAPVatMapping)
        if connection_id:
            query = query.filter(SAPVatMapping.connection_id == connection_id)
        
        mappings = query.all()
        purchases_map = {}
        sales_map = {}

        for m in mappings:
            display_val = m.vat_bucket.code if m.vat_bucket else "EXEMPT"
            if m.vat_bucket and m.vat_bucket.percentage is not None:
                pct = m.vat_bucket.percentage
                display_val = str(int(pct)) if (pct % 1 == 0) else str(pct)
            elif m.vat_bucket and m.vat_bucket.code == "EXEMPT":
                display_val = "EXEMPT"

            code_upper = m.sap_code.strip().upper()
            if m.module == "purchases":
                purchases_map[code_upper] = display_val
            else:
                sales_map[code_upper] = display_val

        return {"purchases": purchases_map, "sales": sales_map}


def get_settings_provider(db: Session) -> SettingsProvider:
    return SettingsProvider(db=db)
