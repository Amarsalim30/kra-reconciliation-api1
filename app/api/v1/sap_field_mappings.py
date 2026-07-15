from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_sap_client
from app.database.database import get_db
from app.models.user import User
from app.models.settings import SystemSetting
from app.models.sap_field_mapping import SAPFieldMapping, VatModule, InternalField, SourceType, TransformationType
from app.schemas.sap_field_mapping import (
    SAPFieldMappingResponse,
    SAPFieldMappingSavePayload,
    SAPFieldMappingPreviewPayload,
    PreviewResponse,
    PreviewResultItem,
    DiagnosticItem,
)
from app.services.sap_field_extractor import extract_and_validate_field, SAPFieldMappingCache
from app.services.settings_service import SettingsConflictError, SettingsService
from app.core.sap_client import SAPClient
from app.core.exceptions import SAPQueryError

router = APIRouter(prefix="/settings/sap-field-mappings", tags=["SAP Field Mappings"])


@router.get("", response_model=List[SAPFieldMappingResponse])
def get_sap_field_mappings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all active SAP field mappings ordered by module, field, and priority.
    """
    return (
        db.query(SAPFieldMapping)
        .order_by(SAPFieldMapping.module, SAPFieldMapping.internal_field, SAPFieldMapping.priority)
        .all()
    )


@router.put("", response_model=List[SAPFieldMappingResponse])
def save_sap_field_mappings(
    payload: SAPFieldMappingSavePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update all SAP field mappings in a transaction, verify settings version for locking, and log changes.
    """
    system_setting = db.query(SystemSetting).first()
    if not system_setting:
        system_setting = SettingsService.get_or_create_system_settings(db)

    # Optimistic locking check
    if system_setting.version != payload.settings_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Optimistic lock conflict: System settings version is {system_setting.version}, but payload supplied {payload.settings_version}."
        )

    # Record changes for audit logging
    old_mappings = db.query(SAPFieldMapping).all()
    old_map_dict = {
        (m.module, m.internal_field, m.priority): {
            "sap_field": m.sap_field,
            "transformation": m.transformation,
            "transformation_value": m.transformation_value,
            "validation_regex": m.validation_regex,
            "is_enabled": m.is_enabled,
        }
        for m in old_mappings
    }

    # Delete existing and replace in transaction
    db.query(SAPFieldMapping).delete()

    new_map_dict = {}
    for item in payload.mappings:
        mapping = SAPFieldMapping(
            module=item.module,
            internal_field=item.internal_field,
            source_type=item.source_type,
            priority=item.priority,
            sap_field=item.sap_field,
            transformation=item.transformation,
            transformation_value=item.transformation_value,
            validation_regex=item.validation_regex,
            description=item.description,
            is_enabled=item.is_enabled,
        )
        db.add(mapping)
        new_map_dict[(item.module, item.internal_field, item.priority)] = {
            "sap_field": item.sap_field,
            "transformation": item.transformation,
            "transformation_value": item.transformation_value,
            "validation_regex": item.validation_regex,
            "is_enabled": item.is_enabled,
        }

    # Compare changes
    changes = {}
    for key, old_val in old_map_dict.items():
        if key not in new_map_dict:
            changes[f"Mapping {key}"] = {"old": str(old_val), "new": "DELETED"}
        elif old_val != new_map_dict[key]:
            changes[f"Mapping {key}"] = {"old": str(old_val), "new": str(new_map_dict[key])}

    for key, new_val in new_map_dict.items():
        if key not in old_map_dict:
            changes[f"Mapping {key}"] = {"old": "NONE", "new": str(new_val)}

    # Increment system setting version
    system_setting.version += 1
    db.add(system_setting)

    db.commit()

    # Invalidate extraction cache
    SAPFieldMappingCache.invalidate()

    if changes:
        SettingsService.record_audit_log(
            db, current_user.id, current_user.email, "update_sap_field_mappings", changes, payload.reason
        )

    return (
        db.query(SAPFieldMapping)
        .order_by(SAPFieldMapping.module, SAPFieldMapping.internal_field, SAPFieldMapping.priority)
        .all()
    )


@router.post("/reset", response_model=List[SAPFieldMappingResponse])
def reset_sap_field_mappings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reset mappings back to standard factory defaults.
    """
    system_setting = db.query(SystemSetting).first()
    if not system_setting:
        system_setting = SettingsService.get_or_create_system_settings(db)

    # Delete all mappings
    db.query(SAPFieldMapping).delete()

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

    system_setting.version += 1
    db.add(system_setting)

    db.commit()

    # Invalidate cache
    SAPFieldMappingCache.invalidate()

    SettingsService.record_audit_log(
        db, current_user.id, current_user.email, "reset_sap_field_mappings", {"mappings": "Reset to Defaults"}
    )

    return (
        db.query(SAPFieldMapping)
        .order_by(SAPFieldMapping.module, SAPFieldMapping.internal_field, SAPFieldMapping.priority)
        .all()
    )


@router.post("/preview", response_model=PreviewResponse)
def preview_sap_field_mappings(
    payload: SAPFieldMappingPreviewPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Execute a mapping dry run preview against a sample JSON document payload.
    Supports previewing draft mapping changes (if passed) or active database configurations.
    """
    # Use draft mappings if supplied, otherwise load active ones from database
    if payload.mappings is not None:
        # Convert schema items to mock model structures for extractor
        mappings = [
            SAPFieldMapping(
                module=m.module,
                internal_field=m.internal_field,
                source_type=m.source_type,
                priority=m.priority,
                sap_field=m.sap_field,
                transformation=m.transformation,
                transformation_value=m.transformation_value,
                validation_regex=m.validation_regex,
                is_enabled=m.is_enabled,
            )
            for m in payload.mappings
        ]
    else:
        mappings = db.query(SAPFieldMapping).all()

    mapped_values = {}
    sample_doc = payload.sample_document

    # Simulate lines if needed
    lines = sample_doc.get("DocumentLines", [])
    first_line = lines[0] if lines else None

    # Run mapping for each InternalField
    for field in InternalField:
        res = extract_and_validate_field(
            sample_doc, first_line, field, mappings,
            reconciliation_session_id="PREVIEW", source_document_type="PreviewInvoice", doc_num="PREVIEW"
        )
        mapped_values[field] = res

    return PreviewResponse(mapped_values=mapped_values)


@router.get("/sample-documents")
def get_sample_documents(
    module: VatModule = Query(..., description="reconciliation module (sales or purchases)"),
    sap_client: SAPClient = Depends(get_sap_client),
    current_user: User = Depends(get_current_user),
):
    """
    List 10 recent documents from the SAP Business One active connection to be selected as test payload.
    """
    endpoint = "Invoices" if module == VatModule.SALES else "PurchaseInvoices"
    try:
        sap_client.login()
        documents = sap_client.get_recent_documents(endpoint, limit=10)
        return [{"docEntry": d.get("DocEntry"), "docNum": d.get("DocNum"), "cardName": d.get("CardName"), "docDate": d.get("DocDate")} for d in documents]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch sample list from SAP: {str(e)}"
        )


@router.get("/sample-document/{doc_entry}")
def get_sample_document(
    doc_entry: int,
    module: VatModule = Query(..., description="reconciliation module (sales or purchases)"),
    sap_client: SAPClient = Depends(get_sap_client),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch a single complete document JSON by DocEntry from the active SAP connection.
    """
    endpoint = "Invoices" if module == VatModule.SALES else "PurchaseInvoices"
    try:
        sap_client.login()
        return sap_client.get_document_by_entry(endpoint, doc_entry)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch document {doc_entry} from SAP: {str(e)}"
        )
