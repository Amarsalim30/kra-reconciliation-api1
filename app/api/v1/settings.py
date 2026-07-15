from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.database import get_db
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
from app.services.configuration_service import ConfigurationService
from app.services.configuration_validator import ConfigValidationError
from app.services.settings_service import SettingsConflictError

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=SettingsCompositeResponse)
def get_composite_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current enterprise system settings composite overview."""
    service = ConfigurationService(db)
    return service.get_composite_overview()


@router.get("/connection", response_model=Optional[SAPConnectionResponse])
def get_sap_connection(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch active SAP Connection details."""
    service = ConfigurationService(db)
    return service.get_sap_connection()


@router.put("/connection", response_model=SAPConnectionResponse)
def update_sap_connection(
    payload: SAPConnectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update active SAP Service Layer connection parameters."""
    service = ConfigurationService(db)
    try:
        return service.update_sap_connection(payload, current_user)
    except SettingsConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except (ValueError, ConfigValidationError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/connection/test", response_model=TestConnectionResponse)
def test_sap_connection(
    payload: TestConnectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Test SAP Service Layer connectivity before saving."""
    service = ConfigurationService(db)
    return service.test_sap_connection(payload)


@router.get("/reconciliation", response_model=SystemSettingsResponse)
def get_reconciliation_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch operational reconciliation tolerances and matching rules."""
    service = ConfigurationService(db)
    return service.get_reconciliation_rules()


@router.put("/reconciliation", response_model=SystemSettingsResponse)
def update_reconciliation_rules(
    payload: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update operational reconciliation tolerances and rules."""
    service = ConfigurationService(db)
    try:
        return service.update_reconciliation_rules(payload, current_user)
    except SettingsConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except (ValueError, ConfigValidationError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/tax", response_model=TaxConfigurationResponse)
def get_tax_configuration(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch KRA section metadata and SAP VAT mappings."""
    service = ConfigurationService(db)
    return service.get_tax_configuration()


@router.put("/tax", response_model=TaxConfigurationResponse)
def update_tax_configuration(
    payload: TaxConfigurationUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update SAP VAT code mappings."""
    service = ConfigurationService(db)
    try:
        return service.update_tax_configuration(payload, current_user)
    except (ValueError, ConfigValidationError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/diagnostics")
def get_diagnostics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run System Doctor diagnostics and return readiness state & checklist."""
    service = ConfigurationService(db)
    return service.get_diagnostics()


@router.get("/audit", response_model=List[SettingAuditLogResponse])
def get_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve audit diff history logs."""
    service = ConfigurationService(db)
    return service.get_audit_logs(limit=limit)


@router.get("/export", response_model=ConfigExportPayload)
def export_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export system configuration JSON payload."""
    service = ConfigurationService(db)
    return service.export_config()


@router.post("/import", response_model=ImportValidationSummary)
def import_config(
    payload: Dict[str, Any],
    dry_run: bool = Query(default=False, description="Perform validation without writing changes"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import system configuration JSON with dry_run validation preview."""
    service = ConfigurationService(db)
    try:
        return service.import_config(payload, dry_run=dry_run, current_user=current_user)
    except (ValueError, ConfigValidationError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/restore")
def restore_defaults(
    scope: str = Query(default="all", description="operational | tax | all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restore default system configuration for specified scope."""
    service = ConfigurationService(db)
    return service.restore_defaults(scope=scope, current_user=current_user)
