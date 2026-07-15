import hashlib
import json
import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.settings import (
    KRASection,
    KRASectionAllowedVat,
    SAPConnection,
    SAPVatMapping,
    SettingAuditLog,
    SystemSetting,
    VATBucket,
)
from app.models.user import User
from app.schemas.settings import (
    ConfigExportPayload,
    ImportDiffItem,
    ImportValidationSummary,
    KRASectionSchema,
    SAPConnectionResponse,
    SAPConnectionUpdate,
    SAPVatMappingItem,
    SettingAuditLogResponse,
    SettingsCompositeResponse,
    StepResult,
    SystemSettingsResponse,
    SystemSettingsUpdate,
    TaxConfigurationResponse,
    TaxConfigurationUpdatePayload,
    TestConnectionRequest,
    TestConnectionResponse,
    VATBucketSchema,
)
from app.services.configuration_validator import ConfigurationValidator, ConfigValidationError
from app.services.settings_cache import settings_cache


class SettingsConflictError(Exception):
    """Raised on optimistic locking version mismatch."""
    pass


# Default built-in VAT codes for seeding newly initialized SAP connections
DEFAULT_BUILTIN_VAT_MAPPINGS = [
    {"module": "purchases", "sap_code": "I1", "description": "Standard Input VAT 16%", "bucket_code": "STANDARD"},
    {"module": "purchases", "sap_code": "I2", "description": "Zero Rated Input VAT 0%", "bucket_code": "ZERO"},
    {"module": "purchases", "sap_code": "I3", "description": "Reduced Input VAT 8%", "bucket_code": "REDUCED"},
    {"module": "purchases", "sap_code": "X1", "description": "Exempt Input VAT", "bucket_code": "EXEMPT"},
    {"module": "purchases", "sap_code": "N2", "description": "Non-Deductible Input VAT 16%", "bucket_code": "STANDARD"},
    {"module": "sales", "sap_code": "O1", "description": "Standard Output VAT 16%", "bucket_code": "STANDARD"},
    {"module": "sales", "sap_code": "O2", "description": "Zero Rated Output VAT 0%", "bucket_code": "ZERO"},
    {"module": "sales", "sap_code": "X0", "description": "Exempt Output VAT", "bucket_code": "EXEMPT"},
]


class SettingsService:
    @classmethod
    def seed_canonical_tax_metadata(cls, db: Session):
        if db.query(VATBucket).count() == 0:
            b1 = VATBucket(id=1, code="STANDARD", display_name="Standard Rate (16%)", percentage=Decimal("16.00"), category="Standard")
            b2 = VATBucket(id=2, code="REDUCED", display_name="Reduced Rate (8%)", percentage=Decimal("8.00"), category="Reduced")
            b3 = VATBucket(id=3, code="ZERO", display_name="Zero Rated (0%)", percentage=Decimal("0.00"), category="Zero")
            b4 = VATBucket(id=4, code="EXEMPT", display_name="Exempt Tax Free", percentage=None, category="Exempt")
            db.add_all([b1, b2, b3, b4])
            db.commit()

        if db.query(KRASection).count() == 0:
            s1 = KRASection(id=1, section_code="SEC_B", display_name="Section B", description="Standard Rated Sales (16%)", expected_vat_bucket_id=1, enabled=True, sort_order=1)
            s2 = KRASection(id=2, section_code="SEC_F", display_name="Section F", description="Standard Rated Purchases (16%)", expected_vat_bucket_id=1, enabled=True, sort_order=2)
            s3 = KRASection(id=3, section_code="SEC_G", display_name="Section G", description="Other Rated Purchases (8%)", expected_vat_bucket_id=2, enabled=True, sort_order=3)
            s4 = KRASection(id=4, section_code="SEC_H", display_name="Section H", description="Zero Rated Purchases (0%)", expected_vat_bucket_id=3, enabled=True, sort_order=4)
            s5 = KRASection(id=5, section_code="SEC_I", display_name="Section I", description="Exempt Purchases", expected_vat_bucket_id=4, enabled=True, sort_order=5)
            db.add_all([s1, s2, s3, s4, s5])
            db.commit()

            db.add_all([
                KRASectionAllowedVat(section_id=1, vat_bucket_id=1),
                KRASectionAllowedVat(section_id=2, vat_bucket_id=1),
                KRASectionAllowedVat(section_id=3, vat_bucket_id=2),
                KRASectionAllowedVat(section_id=4, vat_bucket_id=3),
                KRASectionAllowedVat(section_id=5, vat_bucket_id=4),
            ])
            db.commit()

    @classmethod
    def get_kra_section_mappings(cls, db: Session) -> Dict[str, Any]:
        cls.seed_canonical_tax_metadata(db)
        sections = db.query(KRASection).all()
        result = {}
        for sec in sections:
            code = sec.section_code
            vat_code = "16"
            if sec.expected_vat_bucket:
                if sec.expected_vat_bucket.percentage is not None:
                    pct = sec.expected_vat_bucket.percentage
                    vat_code = str(int(pct)) if (pct % 1 == 0) else str(pct)
                else:
                    vat_code = "EXEMPT"

            result[code] = {
                "identifier": code,
                "module": "sales" if code == "SEC_B" else "purchases",
                "display_name": sec.display_name,
                "filename_regex": "(?i).*sec[_-]?b_with_vat_pin.*" if code == "SEC_B" else f"(?i).*sec[_-]?{code.split('_')[-1].lower()}.*",
                "vat_group": vat_code,
                "required": code in ("SEC_B", "SEC_F"),
                "column_mapping": {
                    "pin": 0 if code == "SEC_B" else 1,
                    "partner_name": 1 if code == "SEC_B" else 2,
                    "invoice_number": 2 if code == "SEC_B" else 4,
                    "invoice_date": 3,
                    "cu_number": 4,
                    "base_amount": 6 if code == "SEC_B" else 7,
                },
                "validation_rules": {
                    "pin_required": True,
                    "allow_negative_amounts": False,
                },
                "active": sec.enabled,
            }
        return result

    @classmethod
    def get_or_create_system_settings(cls, db: Session) -> SystemSetting:
        cls.seed_canonical_tax_metadata(db)
        setting = db.query(SystemSetting).first()
        if not setting:
            env_config = get_settings()
            setting = SystemSetting(
                id=1,
                amount_tolerance=env_config.amount_tolerance,
                date_tolerance=3,
                partner_similarity_threshold=0.85,
                version=1,
            )
            db.add(setting)
            db.commit()
            db.refresh(setting)

        from app.models.sap_field_mapping import SAPFieldMapping
        if db.query(SAPFieldMapping).count() == 0:
            from app.services.sap_mapper import DEFAULT_SAP_FIELD_MAPPINGS
            for mapping in DEFAULT_SAP_FIELD_MAPPINGS:
                db.add(
                    SAPFieldMapping(
                        module=mapping.module,
                        internal_field=mapping.internal_field,
                        source_type=mapping.source_type,
                        priority=mapping.priority,
                        sap_field=mapping.sap_field,
                        transformation=mapping.transformation,
                        transformation_value=mapping.transformation_value,
                        validation_regex=mapping.validation_regex,
                        is_enabled=mapping.is_enabled,
                        description=mapping.description,
                    )
                )
            db.commit()

        return setting

    @staticmethod
    def get_active_connection(db: Session, system_setting: SystemSetting) -> Optional[SAPConnection]:
        if system_setting.active_connection_id:
            conn = db.query(SAPConnection).filter(SAPConnection.id == system_setting.active_connection_id).first()
            if conn and conn.is_active:
                return conn
        return db.query(SAPConnection).filter(SAPConnection.is_active == True).first()

    @classmethod
    def seed_default_vat_mappings(cls, db: Session, connection_id: int):
        buckets = {b.code: b.id for b in db.query(VATBucket).all()}
        if not buckets:
            return

        existing_codes = {
            (m.module, m.sap_code)
            for m in db.query(SAPVatMapping).filter(SAPVatMapping.connection_id == connection_id).all()
        }
        to_add = []
        for default_m in DEFAULT_BUILTIN_VAT_MAPPINGS:
            key = (default_m["module"], default_m["sap_code"])
            if key not in existing_codes:
                bucket_id = buckets.get(default_m["bucket_code"])
                if bucket_id:
                    to_add.append(
                        SAPVatMapping(
                            connection_id=connection_id,
                            module=default_m["module"],
                            sap_code=default_m["sap_code"],
                            description=default_m["description"],
                            vat_bucket_id=bucket_id,
                            is_builtin=True,
                        )
                    )
        if to_add:
            db.add_all(to_add)
            db.commit()

    @classmethod
    def get_tax_configuration(cls, db: Session, connection_id: Optional[int] = None) -> TaxConfigurationResponse:
        buckets = db.query(VATBucket).all()
        bucket_map = {b.id: b.code for b in buckets}

        bucket_schemas = [
            VATBucketSchema(
                id=b.id,
                code=b.code,
                display_name=b.display_name,
                percentage=b.percentage,
                category=b.category,
            )
            for b in buckets
        ]

        sections = db.query(KRASection).order_by(KRASection.sort_order.asc()).all()
        section_schemas = []
        for sec in sections:
            allowed_buckets = [link.vat_bucket.code for link in sec.allowed_vat_links if link.vat_bucket]
            section_schemas.append(
                KRASectionSchema(
                    id=sec.id,
                    section_code=sec.section_code,
                    display_name=sec.display_name,
                    description=sec.description,
                    expected_vat_bucket_code=bucket_map.get(sec.expected_vat_bucket_id, "EXEMPT"),
                    allowed_vat_bucket_codes=allowed_buckets,
                    enabled=sec.enabled,
                    sort_order=sec.sort_order,
                )
            )

        mappings = []
        if connection_id:
            raw_mappings = db.query(SAPVatMapping).filter(SAPVatMapping.connection_id == connection_id).all()
            for m in raw_mappings:
                mappings.append(
                    SAPVatMappingItem(
                        id=m.id,
                        module=m.module,
                        sap_code=m.sap_code,
                        description=m.description,
                        vat_bucket_code=bucket_map.get(m.vat_bucket_id, "EXEMPT"),
                        is_builtin=m.is_builtin,
                    )
                )

        purchases_count = sum(1 for m in mappings if m.module == "purchases")
        sales_count = sum(1 for m in mappings if m.module == "sales")
        coverage = {
            "total": len(mappings),
            "purchases": purchases_count,
            "sales": sales_count,
            "unmapped": 0,
        }

        return TaxConfigurationResponse(
            vat_buckets=bucket_schemas,
            kra_sections=section_schemas,
            vat_mappings=mappings,
            coverage=coverage,
        )

    @classmethod
    def get_composite_settings(cls, db: Session) -> SettingsCompositeResponse:
        system_setting = cls.get_or_create_system_settings(db)
        active_conn = cls.get_active_connection(db, system_setting)

        env_fallback = False
        sap_conn_resp: Optional[SAPConnectionResponse] = None
        tax_config: TaxConfigurationResponse = TaxConfigurationResponse(
            vat_buckets=[], kra_sections=[], vat_mappings=[], coverage={"total": 0, "purchases": 0, "sales": 0, "unmapped": 0}
        )

        if active_conn:
            cls.seed_default_vat_mappings(db, active_conn.id)
            sap_conn_resp = SAPConnectionResponse.model_validate(active_conn)
            tax_config = cls.get_tax_configuration(db, active_conn.id)
        else:
            env_fallback = True
            env_cfg = get_settings()
            if env_cfg.sap_base_url:
                sap_conn_resp = SAPConnectionResponse(
                    id=0,
                    name="Environment SAP (.env)",
                    base_url=str(env_cfg.sap_base_url).rstrip("/"),
                    company_db=env_cfg.sap_company_db,
                    username=env_cfg.sap_username,
                    password_set=bool(env_cfg.sap_password.get_secret_value()),
                    verify_ssl=env_cfg.sap_verify_ssl,
                    is_active=True,
                    version=1,
                    last_tested_at=None,
                    last_status="UNKNOWN",
                    created_at=system_setting.updated_at,
                    updated_at=system_setting.updated_at,
                )
            tax_config = cls.get_tax_configuration(db)

        warning = None
        if system_setting.amount_tolerance > Decimal("1000.00"):
            warning = f"Warning: Amount tolerance (KES {system_setting.amount_tolerance}) exceeds KES 1,000.00."

        sys_resp = SystemSettingsResponse(
            id=system_setting.id,
            active_connection_id=system_setting.active_connection_id,
            amount_tolerance=system_setting.amount_tolerance,
            date_tolerance=system_setting.date_tolerance,
            partner_similarity_threshold=float(system_setting.partner_similarity_threshold),
            version=system_setting.version,
            updated_at=system_setting.updated_at,
            warning=warning,
        )

        return SettingsCompositeResponse(
            sap_connection=sap_conn_resp,
            system_settings=sys_resp,
            tax_configuration=tax_config,
            is_using_env_fallback=env_fallback,
        )

    @classmethod
    def save_or_update_sap_connection(
        cls, db: Session, payload: SAPConnectionUpdate, current_user: Optional[User] = None
    ) -> SAPConnectionResponse:
        system_setting = cls.get_or_create_system_settings(db)
        active_conn = cls.get_active_connection(db, system_setting)

        user_id = current_user.id if current_user else None
        user_email = current_user.email if current_user else "system"

        if not active_conn:
            ConfigurationValidator.validate_sap_connection_data(
                payload.base_url or "", payload.company_db or "", payload.username or ""
            )
            conn = SAPConnection(
                name=payload.name or "Primary SAP Connection",
                base_url=payload.base_url,
                company_db=payload.company_db,
                username=payload.username,
                password=payload.password,
                verify_ssl=payload.verify_ssl if payload.verify_ssl is not None else True,
                is_active=True,
                version=1,
                updated_by_id=user_id,
            )
            db.add(conn)
            db.commit()
            db.refresh(conn)

            system_setting.active_connection_id = conn.id
            db.commit()

            cls.seed_default_vat_mappings(db, conn.id)
            cls.record_audit_log(
                db, user_id, user_email, "create_sap_connection",
                {"connection": {"old": None, "new": conn.name}},
                reason=payload.reason or "Initial SAP setup",
                entity="SAPConnection", entity_id=str(conn.id), field="name"
            )
            settings_cache.invalidate()
            return SAPConnectionResponse.model_validate(conn)

        if active_conn.version != payload.version:
            raise SettingsConflictError(
                f"Optimistic lock conflict: Connection version is {active_conn.version}, supplied {payload.version}."
            )

        changes = {}
        if payload.name is not None and payload.name != active_conn.name:
            changes["name"] = {"old": active_conn.name, "new": payload.name}
            active_conn.name = payload.name
        if payload.base_url is not None and payload.base_url != active_conn.base_url:
            changes["base_url"] = {"old": active_conn.base_url, "new": payload.base_url}
            active_conn.base_url = payload.base_url
        if payload.company_db is not None and payload.company_db != active_conn.company_db:
            changes["company_db"] = {"old": active_conn.company_db, "new": payload.company_db}
            active_conn.company_db = payload.company_db
        if payload.username is not None and payload.username != active_conn.username:
            changes["username"] = {"old": active_conn.username, "new": payload.username}
            active_conn.username = payload.username
        if payload.verify_ssl is not None and payload.verify_ssl != active_conn.verify_ssl:
            changes["verify_ssl"] = {"old": str(active_conn.verify_ssl), "new": str(payload.verify_ssl)}
            active_conn.verify_ssl = payload.verify_ssl
        if payload.password:
            changes["password"] = {"old": "••••••••", "new": "•••••••• (Updated)"}
            active_conn.password = payload.password

        if changes:
            active_conn.version += 1
            active_conn.updated_by_id = user_id
            db.commit()
            db.refresh(active_conn)
            cls.record_audit_log(
                db, user_id, user_email, "update_sap_connection", changes,
                reason=payload.reason or "Updated connection details",
                entity="SAPConnection", entity_id=str(active_conn.id)
            )
            settings_cache.invalidate()

        return SAPConnectionResponse.model_validate(active_conn)

    @classmethod
    def update_system_settings(
        cls, db: Session, payload: SystemSettingsUpdate, current_user: Optional[User] = None
    ) -> SystemSettingsResponse:
        system_setting = cls.get_or_create_system_settings(db)

        if system_setting.version != payload.version:
            raise SettingsConflictError(
                f"Optimistic lock conflict: Settings version is {system_setting.version}, supplied {payload.version}."
            )

        if not payload.reason or not payload.reason.strip():
            raise ConfigValidationError("Audit note reason is mandatory for operational settings update.")

        ConfigurationValidator.validate_amount_tolerance(payload.amount_tolerance)
        ConfigurationValidator.validate_date_tolerance(payload.date_tolerance)
        ConfigurationValidator.validate_partner_similarity(payload.partner_similarity_threshold)

        changes = {}
        user_id = current_user.id if current_user else None
        user_email = current_user.email if current_user else "system"

        if payload.amount_tolerance != system_setting.amount_tolerance:
            changes["amount_tolerance"] = {
                "old": str(system_setting.amount_tolerance),
                "new": str(payload.amount_tolerance)
            }
            system_setting.amount_tolerance = payload.amount_tolerance

        if payload.date_tolerance != system_setting.date_tolerance:
            changes["date_tolerance"] = {
                "old": str(system_setting.date_tolerance),
                "new": str(payload.date_tolerance)
            }
            system_setting.date_tolerance = payload.date_tolerance

        if payload.partner_similarity_threshold != float(system_setting.partner_similarity_threshold):
            changes["partner_similarity_threshold"] = {
                "old": str(system_setting.partner_similarity_threshold),
                "new": str(payload.partner_similarity_threshold)
            }
            system_setting.partner_similarity_threshold = payload.partner_similarity_threshold

        if changes:
            system_setting.version += 1
            system_setting.updated_by_id = user_id
            db.commit()
            db.refresh(system_setting)
            cls.record_audit_log(
                db, user_id, user_email, "update_system_settings", changes,
                reason=payload.reason, entity="SystemSetting", entity_id=str(system_setting.id)
            )
            settings_cache.invalidate()

        warning = None
        if system_setting.amount_tolerance > Decimal("1000.00"):
            warning = f"Warning: Amount tolerance (KES {system_setting.amount_tolerance}) exceeds KES 1,000.00."

        return SystemSettingsResponse(
            id=system_setting.id,
            active_connection_id=system_setting.active_connection_id,
            amount_tolerance=system_setting.amount_tolerance,
            date_tolerance=system_setting.date_tolerance,
            partner_similarity_threshold=float(system_setting.partner_similarity_threshold),
            version=system_setting.version,
            updated_at=system_setting.updated_at,
            warning=warning,
        )

    @classmethod
    def save_tax_configuration(
        cls, db: Session, payload: TaxConfigurationUpdatePayload, current_user: Optional[User] = None
    ) -> TaxConfigurationResponse:
        if not payload.reason or not payload.reason.strip():
            raise ConfigValidationError("Audit note reason is mandatory for tax configuration changes.")

        system_setting = cls.get_or_create_system_settings(db)
        active_conn = cls.get_active_connection(db, system_setting)
        conn_id = payload.connection_id or (active_conn.id if active_conn else None)
        if not conn_id:
            raise ConfigValidationError("No active SAP connection exists to associate tax mappings.")

        buckets = {b.code: b.id for b in db.query(VATBucket).all()}
        existing = {
            (m.module, m.sap_code.strip().upper()): m
            for m in db.query(SAPVatMapping).filter(SAPVatMapping.connection_id == conn_id).all()
        }

        user_id = current_user.id if current_user else None
        user_email = current_user.email if current_user else "system"
        changes = {}

        submitted_keys = set()
        for item in payload.mappings:
            code = item.sap_code.strip().upper()
            key = (item.module, code)
            if key in submitted_keys:
                raise ConfigValidationError(f"Duplicate tax code '{code}' submitted for module '{item.module}'.")
            submitted_keys.add(key)

            bucket_id = buckets.get(item.vat_bucket_code)
            if not bucket_id:
                raise ConfigValidationError(f"Invalid canonical VAT rate bucket '{item.vat_bucket_code}'.")

            if key in existing:
                db_item = existing[key]
                if db_item.vat_bucket_id != bucket_id or db_item.description != item.description:
                    changes[f"{item.module}:{code}"] = {
                        "old": f"{db_item.vat_bucket.code if db_item.vat_bucket else ''} ({db_item.description})",
                        "new": f"{item.vat_bucket_code} ({item.description})"
                    }
                    db_item.vat_bucket_id = bucket_id
                    db_item.description = item.description
            else:
                new_item = SAPVatMapping(
                    connection_id=conn_id,
                    module=item.module,
                    sap_code=code,
                    description=item.description,
                    vat_bucket_id=bucket_id,
                    is_builtin=False,
                )
                db.add(new_item)
                changes[f"{item.module}:{code}"] = {"old": None, "new": f"{item.vat_bucket_code} ({item.description})"}

        for key, db_item in existing.items():
            if key not in submitted_keys:
                if db_item.is_builtin:
                    raise ConfigValidationError(f"Cannot delete built-in tax code '{db_item.sap_code}'.")
                changes[f"{db_item.module}:{db_item.sap_code}"] = {"old": db_item.vat_bucket.code, "new": "DELETED"}
                db.delete(db_item)

        if changes:
            system_setting.version += 1
            db.commit()
            cls.record_audit_log(
                db, user_id, user_email, "update_tax_mappings", changes,
                reason=payload.reason, entity="SAPVatMapping", entity_id=str(conn_id)
            )
            settings_cache.invalidate()

        return cls.get_tax_configuration(db, conn_id)

    @classmethod
    def test_sap_connection(cls, db: Session, req: TestConnectionRequest) -> TestConnectionResponse:
        system_setting = cls.get_or_create_system_settings(db)
        active_conn = cls.get_active_connection(db, system_setting)

        base_url = (req.base_url or (active_conn.base_url if active_conn else "")).strip().rstrip("/")
        company_db = (req.company_db or (active_conn.company_db if active_conn else "")).strip()
        username = (req.username or (active_conn.username if active_conn else "")).strip()
        password = req.password or (active_conn.password if active_conn else "")
        verify_ssl = req.verify_ssl if req.verify_ssl is not None else (active_conn.verify_ssl if active_conn else True)

        if not base_url or not company_db or not username or not password:
            env_cfg = get_settings()
            if not base_url and env_cfg.sap_base_url:
                base_url = str(env_cfg.sap_base_url).rstrip("/")
            if not company_db:
                company_db = env_cfg.sap_company_db
            if not username:
                username = env_cfg.sap_username
            if not password:
                password = env_cfg.sap_password.get_secret_value()
            verify_ssl = env_cfg.sap_verify_ssl

        steps: Dict[str, StepResult] = {}
        start_time = time.time()

        if not base_url:
            return TestConnectionResponse(
                connected=False,
                steps={"host_reachable": StepResult(status="fail", message="No SAP Base URL provided.")},
                error_message="Missing SAP Server Base URL.",
            )

        client = httpx.Client(verify=verify_ssl, timeout=8.0)
        try:
            ping_resp = client.post(
                f"{base_url}/Login",
                json={"CompanyDB": company_db, "UserName": username, "Password": password},
            )
            elapsed_ms = round((time.time() - start_time) * 1000, 1)
            steps["host_reachable"] = StepResult(status="pass", message=f"Host responded in {elapsed_ms}ms.")
        except Exception as e:
            steps["host_reachable"] = StepResult(status="fail", message=f"Failed to connect: {str(e)}")
            return TestConnectionResponse(connected=False, steps=steps, error_message=str(e))

        if ping_resp.status_code != 200:
            err_data = ping_resp.json() if ping_resp.headers.get("content-type", "").startswith("application/json") else {}
            err_msg = err_data.get("error", {}).get("message", {}).get("value", f"HTTP {ping_resp.status_code}")
            steps["authenticated"] = StepResult(status="fail", message=f"Login failed: {err_msg}")
            return TestConnectionResponse(connected=False, steps=steps, error_message=err_msg)

        steps["authenticated"] = StepResult(status="pass", message=f"Authenticated as '{username}'.")
        steps["company_valid"] = StepResult(status="pass", message=f"Database '{company_db}' accessible.")

        metadata = {
            "system_version": "SAP Business One Service Layer",
            "company_name": company_db,
            "latency_ms": elapsed_ms,
        }

        if active_conn:
            active_conn.last_tested_at = datetime.now(timezone.utc)
            active_conn.last_status = "PASS"
            db.commit()

        return TestConnectionResponse(connected=True, steps=steps, metadata=metadata)

    @classmethod
    def export_configuration(cls, db: Session) -> ConfigExportPayload:
        sys = cls.get_or_create_system_settings(db)
        tax = cls.get_tax_configuration(db)

        settings_dict = {
            "amount_tolerance": str(sys.amount_tolerance),
            "date_tolerance": sys.date_tolerance,
            "partner_similarity_threshold": float(sys.partner_similarity_threshold),
            "tax_configuration": {
                "mappings": [m.model_dump() for m in tax.vat_mappings]
            }
        }

        return ConfigExportPayload(
            schema_version=2,
            application="KRA Reconciliation System",
            exported_at=datetime.now(timezone.utc),
            settings=settings_dict
        )

    @classmethod
    def import_configuration(
        cls, db: Session, json_data: Dict[str, Any], dry_run: bool = False, current_user: Optional[User] = None
    ) -> ImportValidationSummary:
        ConfigurationValidator.validate_import_payload(json_data)
        settings_obj = json_data["settings"]

        diffs: List[ImportDiffItem] = []
        sys = cls.get_or_create_system_settings(db)

        # Operational Diff check
        new_amt = Decimal(str(settings_obj.get("amount_tolerance", sys.amount_tolerance)))
        if new_amt != sys.amount_tolerance:
            diffs.append(ImportDiffItem(entity="SystemSetting", key="amount_tolerance", old=str(sys.amount_tolerance), new=str(new_amt)))

        new_date = int(settings_obj.get("date_tolerance", sys.date_tolerance))
        if new_date != sys.date_tolerance:
            diffs.append(ImportDiffItem(entity="SystemSetting", key="date_tolerance", old=str(sys.date_tolerance), new=str(new_date)))

        new_thresh = float(settings_obj.get("partner_similarity_threshold", sys.partner_similarity_threshold))
        if new_thresh != float(sys.partner_similarity_threshold):
            diffs.append(ImportDiffItem(entity="SystemSetting", key="partner_similarity_threshold", old=str(sys.partner_similarity_threshold), new=str(new_thresh)))

        if dry_run:
            return ImportValidationSummary(valid=True, diffs=diffs)

        # Apply changes
        user_id = current_user.id if current_user else None
        user_email = current_user.email if current_user else "system"

        sys.amount_tolerance = new_amt
        sys.date_tolerance = new_date
        sys.partner_similarity_threshold = new_thresh
        sys.version += 1

        db.commit()
        cls.record_audit_log(
            db, user_id, user_email, "import_configuration",
            {"imported_diffs": [d.model_dump() for d in diffs]},
            reason="Imported configuration payload", entity="SystemSetting", entity_id=str(sys.id)
        )
        settings_cache.invalidate()

        return ImportValidationSummary(valid=True, diffs=diffs)

    @classmethod
    def restore_defaults(
        cls, db: Session, scope: str = "all", current_user: Optional[User] = None
    ) -> Dict[str, Any]:
        sys = cls.get_or_create_system_settings(db)
        user_id = current_user.id if current_user else None
        user_email = current_user.email if current_user else "system"

        if scope in ("operational", "all"):
            sys.amount_tolerance = Decimal("10.00")
            sys.date_tolerance = 3
            sys.partner_similarity_threshold = 0.85
            sys.version += 1

        db.commit()
        cls.record_audit_log(
            db, user_id, user_email, "restore_defaults",
            {"scope": scope}, reason=f"Restored default settings for scope '{scope}'"
        )
        settings_cache.invalidate()

        return {"status": "success", "scope": scope}

    @staticmethod
    def record_audit_log(
        db: Session,
        user_id: Optional[int],
        user_email: Optional[str],
        action: str,
        changes_json: Dict[str, Any],
        reason: Optional[str] = None,
        entity: Optional[str] = None,
        entity_id: Optional[str] = None,
        field: Optional[str] = None,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        ip_address: Optional[str] = None,
    ):
        log = SettingAuditLog(
            user_id=user_id,
            user_email=user_email,
            ip_address=ip_address,
            entity=entity,
            entity_id=entity_id,
            field=field,
            old_value=old_value,
            new_value=new_value,
            action=action,
            changes_json=changes_json,
            reason=reason,
        )
        db.add(log)
        db.commit()

    @staticmethod
    def get_audit_logs(db: Session, limit: int = 50) -> List[SettingAuditLog]:
        return db.query(SettingAuditLog).order_by(SettingAuditLog.created_at.desc()).limit(limit).all()
