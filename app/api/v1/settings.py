from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.settings import (
    SAPConnectionResponse,
    SAPConnectionUpdate,
    SettingAuditLogResponse,
    SettingsCompositeResponse,
    SystemSettingsResponse,
    SystemSettingsUpdate,
    TestConnectionRequest,
    TestConnectionResponse,
    VATMappingItem,
    VATMappingsUpdatePayload,
)
from app.services.settings_service import SettingsConflictError, SettingsService

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=SettingsCompositeResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get current enterprise system settings, active SAP connection metadata, and VAT mappings.
    """
    return SettingsService.get_composite_settings(db)


@router.put("/sap-connection", response_model=SAPConnectionResponse)
def update_sap_connection(
    payload: SAPConnectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create or update active SAP Service Layer connection parameters. Supports optimistic version locking.
    """
    try:
        return SettingsService.save_or_update_sap_connection(db, payload, current_user)
    except SettingsConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/system-settings", response_model=SystemSettingsResponse)
def update_system_settings(
    payload: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update operational reconciliation rules and tolerances. Supports optimistic version locking.
    """
    try:
        return SettingsService.update_system_settings(db, payload, current_user)
    except SettingsConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/vat-mappings", response_model=List[VATMappingItem])
def update_vat_mappings(
    payload: VATMappingsUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update module-level SAP VAT code mappings to canonical rate categories.
    """
    try:
        return SettingsService.save_vat_mappings(db, payload, current_user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/test-sap", response_model=TestConnectionResponse)
def test_sap_connection(
    payload: TestConnectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Test SAP Service Layer connectivity using active form parameters before saving.
    """
    return SettingsService.test_sap_connection(db, payload)


@router.get("/audit-logs", response_model=List[SettingAuditLogResponse])
def get_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve historical audit logs of system configuration changes.
    """
    raw_logs = SettingsService.get_audit_logs(db, limit=limit)
    return [SettingAuditLogResponse.model_validate(log) for log in raw_logs]
