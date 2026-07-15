from dataclasses import dataclass
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session

from app.models.settings import SystemSetting, SAPConnection, SAPVatMapping, KRASection, VATBucket


@dataclass
class DiagnosticItem:
    name: str
    status: str  # "PASS" | "WARN" | "FAIL"
    severity: str  # "CRITICAL" | "WARNING" | "INFO"
    category: str  # "SAP" | "TAX" | "SYSTEM"
    is_blocking: bool
    message: str
    recommendation: Optional[str] = None


class ConfigurationHealthService:
    """
    System Doctor validator executing system health, diagnostic checks, and coverage metrics.
    """

    def __init__(self, db: Session):
        self.db = db

    def check_health(self) -> Dict[str, Any]:
        items: List[DiagnosticItem] = []

        sys_setting = self.db.query(SystemSetting).first()
        active_conn = None
        if sys_setting and sys_setting.active_connection_id:
            active_conn = self.db.query(SAPConnection).filter(SAPConnection.id == sys_setting.active_connection_id).first()
        if not active_conn:
            active_conn = self.db.query(SAPConnection).filter(SAPConnection.is_active == True).first()

        # 1. Check SAP Connection configured
        if not active_conn:
            items.append(DiagnosticItem(
                name="SAP Endpoint Configured",
                status="FAIL",
                severity="CRITICAL",
                category="SAP",
                is_blocking=True,
                message="No active SAP Connection has been configured.",
                recommendation="Configure SAP connection details in Connection settings."
            ))
        else:
            items.append(DiagnosticItem(
                name="SAP Endpoint Configured",
                status="PASS",
                severity="INFO",
                category="SAP",
                is_blocking=False,
                message=f"Connected to '{active_conn.name}' ({active_conn.base_url})."
            ))

        # 2. Check VAT Buckets Existence
        buckets_count = self.db.query(VATBucket).count()
        if buckets_count == 0:
            items.append(DiagnosticItem(
                name="Canonical VAT Buckets",
                status="FAIL",
                severity="CRITICAL",
                category="TAX",
                is_blocking=True,
                message="No canonical VAT buckets found in system.",
                recommendation="Run migrations or restore default tax configuration."
            ))
        else:
            items.append(DiagnosticItem(
                name="Canonical VAT Buckets",
                status="PASS",
                severity="INFO",
                category="TAX",
                is_blocking=False,
                message=f"Found {buckets_count} canonical VAT buckets."
            ))

        # 3. Check KRA Sections configuration
        sections = self.db.query(KRASection).filter(KRASection.enabled == True).all()
        if not sections:
            items.append(DiagnosticItem(
                name="KRA Sections Enabled",
                status="WARN",
                severity="WARNING",
                category="TAX",
                is_blocking=False,
                message="No KRA sections are currently enabled.",
                recommendation="Enable required KRA sections."
            ))
        else:
            items.append(DiagnosticItem(
                name="KRA Sections Enabled",
                status="PASS",
                severity="INFO",
                category="TAX",
                is_blocking=False,
                message=f"{len(sections)} active KRA sections configured."
            ))

        # 4. Check Tax Mapping Coverage
        mappings = self.db.query(SAPVatMapping).all()
        if active_conn:
            conn_mappings = [m for m in mappings if m.connection_id == active_conn.id]
        else:
            conn_mappings = mappings

        purchases_count = sum(1 for m in conn_mappings if m.module == "purchases")
        sales_count = sum(1 for m in conn_mappings if m.module == "sales")

        if len(conn_mappings) == 0:
            items.append(DiagnosticItem(
                name="SAP Tax Code Mappings",
                status="WARN",
                severity="WARNING",
                category="TAX",
                is_blocking=False,
                message="No custom or built-in SAP VAT code mappings exist for the connection.",
                recommendation="Configure SAP VAT code mappings under Tax Configuration."
            ))
        else:
            items.append(DiagnosticItem(
                name="SAP Tax Code Mappings",
                status="PASS",
                severity="INFO",
                category="TAX",
                is_blocking=False,
                message=f"{len(conn_mappings)} SAP VAT tax code mappings registered ({purchases_count} Purchases, {sales_count} Sales)."
            ))

        # 5. Amount Tolerance Check
        if sys_setting and sys_setting.amount_tolerance > 1000.0:
            items.append(DiagnosticItem(
                name="Amount Variance Tolerance",
                status="WARN",
                severity="WARNING",
                category="SYSTEM",
                is_blocking=False,
                message=f"Amount tolerance is set to KES {sys_setting.amount_tolerance:.2f}, which is unusually high.",
                recommendation="Review tolerance setting to prevent false positives."
            ))
        else:
            items.append(DiagnosticItem(
                name="Amount Variance Tolerance",
                status="PASS",
                severity="INFO",
                category="SYSTEM",
                is_blocking=False,
                message=f"Amount tolerance configured to KES {sys_setting.amount_tolerance if sys_setting else 10.00:.2f}."
            ))

        # Determine Readiness State
        has_critical = any(item.is_blocking for item in items)
        has_warning = any(item.status == "WARN" for item in items)

        if has_critical:
            readiness = "Blocked"
        elif has_warning:
            readiness = "Warning"
        else:
            readiness = "Ready"

        coverage_ratio = {
            "total_mapped": len(conn_mappings),
            "purchases_mapped": purchases_count,
            "sales_mapped": sales_count,
            "unmapped": 0,
            "duplicates": 0
        }

        return {
            "readiness": readiness,
            "checks": [
                {
                    "name": i.name,
                    "status": i.status,
                    "severity": i.severity,
                    "category": i.category,
                    "is_blocking": i.is_blocking,
                    "message": i.message,
                    "recommendation": i.recommendation
                }
                for i in items
            ],
            "coverage": coverage_ratio
        }
