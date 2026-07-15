import logging
import re
from typing import Any, Dict, List, Tuple, Optional
from app.models.sap_field_mapping import SAPFieldMapping, TransformationType, InternalField, SourceType, VatModule
from app.schemas.sap_field_mapping import DiagnosticItem, PreviewResultItem

logger = logging.getLogger(__name__)


class BaseTransformation:
    def transform(self, val: str, param: str = None) -> str:
        raise NotImplementedError


class NoneTransformation(BaseTransformation):
    def transform(self, val: str, param: str = None) -> str:
        return val if val else ""


class BeforeSlashTransformation(BaseTransformation):
    def transform(self, val: str, param: str = None) -> str:
        return val.split("/")[0].strip() if val else ""


class AfterSlashTransformation(BaseTransformation):
    def transform(self, val: str, param: str = None) -> str:
        if not val:
            return ""
        parts = val.split("/")
        return parts[1].strip() if len(parts) > 1 else ""


class RegexTransformation(BaseTransformation):
    def transform(self, val: str, param: str = None) -> str:
        if not val or not param:
            return val if val else ""
        try:
            match = re.search(param, val)
            return match.group(1).strip() if match else ""
        except Exception as e:
            logger.error(f"RegexTransformation error parsing '{val}' with pattern '{param}': {e}")
            return ""


class RegexReplaceTransformation(BaseTransformation):
    def transform(self, val: str, param: str = None) -> str:
        if not val or not param:
            return val if val else ""
        try:
            parts = param.split("|")
            pattern = parts[0]
            replacement = parts[1] if len(parts) > 1 else ""
            return re.sub(pattern, replacement, val).strip()
        except Exception as e:
            logger.error(f"RegexReplaceTransformation error replacing '{val}' with pattern '{param}': {e}")
            return val


class TrimTransformation(BaseTransformation):
    def transform(self, val: str, param: str = None) -> str:
        return val.strip() if val else ""


class UppercaseTransformation(BaseTransformation):
    def transform(self, val: str, param: str = None) -> str:
        return val.upper() if val else ""


class LowercaseTransformation(BaseTransformation):
    def transform(self, val: str, param: str = None) -> str:
        return val.lower() if val else ""


TRANSFORMATION_REGISTRY = {
    TransformationType.NONE: NoneTransformation(),
    TransformationType.BEFORE_SLASH: BeforeSlashTransformation(),
    TransformationType.AFTER_SLASH: AfterSlashTransformation(),
    TransformationType.REGEX: RegexTransformation(),
    TransformationType.REGEX_REPLACE: RegexReplaceTransformation(),
    TransformationType.TRIM: TrimTransformation(),
    TransformationType.UPPERCASE: UppercaseTransformation(),
    TransformationType.LOWERCASE: LowercaseTransformation(),
}


class SAPFieldMappingCache:
    _cache: Dict[VatModule, List[SAPFieldMapping]] = {}

    @classmethod
    def get_mappings(cls, db, module: VatModule) -> List[SAPFieldMapping]:
        if module not in cls._cache:
            cls._cache[module] = (
                db.query(SAPFieldMapping)
                .filter(SAPFieldMapping.module == module)
                .order_by(SAPFieldMapping.priority.asc())
                .all()
            )
        return cls._cache[module]

    @classmethod
    def invalidate(cls):
        cls._cache.clear()


def extract_and_validate_field(
    document: Dict[str, Any],
    line: Optional[Dict[str, Any]],
    internal_field: InternalField,
    mapping_rules: List[SAPFieldMapping],
    reconciliation_session_id: str = "N/A",
    source_document_type: str = "Document",
    doc_num: str = "Unknown"
) -> PreviewResultItem:
    """
    Evaluates the priority-based field extraction rules for a specific InternalField.
    Applies transformations and regex validation.
    Returns PreviewResultItem containing the resolved value, diagnostics, and warnings/errors.
    """
    diagnostics: List[DiagnosticItem] = []
    warnings: List[str] = []
    errors: List[str] = []

    # Filter rules for this specific internal field
    rules = [r for r in mapping_rules if r.internal_field == internal_field]
    if not rules:
        return PreviewResultItem(value=None, diagnostics=diagnostics, warnings=warnings, errors=errors)

    # Sort by priority just in case
    rules.sort(key=lambda r: r.priority)

    for rule in rules:
        if not rule.is_enabled:
            diagnostics.append(
                DiagnosticItem(
                    priority=rule.priority,
                    sap_field=rule.sap_field,
                    status="disabled"
                )
            )
            continue

        # Extract raw value depending on source_type
        raw_val = None
        if rule.source_type == SourceType.LINE:
            if line is not None:
                raw_val = line.get(rule.sap_field)
        else:
            raw_val = document.get(rule.sap_field)

        if raw_val is None or str(raw_val).strip() == "":
            diagnostics.append(
                DiagnosticItem(
                    priority=rule.priority,
                    sap_field=rule.sap_field,
                    status="empty"
                )
            )
            continue

        val_str = str(raw_val).strip()

        # Apply transformation
        transformer = TRANSFORMATION_REGISTRY.get(rule.transformation)
        if transformer:
            transformed = transformer.transform(val_str, rule.transformation_value)
        else:
            transformed = val_str

        if not transformed:
            diagnostics.append(
                DiagnosticItem(
                    priority=rule.priority,
                    sap_field=rule.sap_field,
                    status="empty",
                    raw_value=val_str
                )
            )
            continue

        # Apply Validation Regex (if configured)
        status = "found"
        if rule.validation_regex:
            try:
                if not re.match(rule.validation_regex, transformed):
                    status = "failed_validation"
                    warn_msg = (
                        f"SAP {source_document_type} {doc_num} field '{internal_field.value}' "
                        f"value '{transformed}' extracted from '{rule.sap_field}' "
                        f"failed validation regex '{rule.validation_regex}'."
                    )
                    warnings.append(warn_msg)
                    logger.warning(f"[ReconciliationSession: {reconciliation_session_id}] {warn_msg}")
            except Exception as e:
                err_msg = f"Invalid validation regex '{rule.validation_regex}': {e}"
                errors.append(err_msg)
                logger.error(err_msg)

        diagnostics.append(
            DiagnosticItem(
                priority=rule.priority,
                sap_field=rule.sap_field,
                status=status,
                raw_value=val_str,
                transformed_value=transformed
            )
        )

        # We found a value (even if validation fails, it counts as matched and we stop evaluating further priorities)
        return PreviewResultItem(
            value=transformed,
            diagnostics=diagnostics,
            warnings=warnings,
            errors=errors
        )

    # If all rules evaluated to empty/disabled
    return PreviewResultItem(
        value=None,
        diagnostics=diagnostics,
        warnings=warnings,
        errors=errors
    )
