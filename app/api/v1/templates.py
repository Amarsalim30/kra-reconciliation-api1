from fastapi import APIRouter, Response, Depends
from app.schemas.invoice import ReconciliationType
from app.services import template_service
from app.core.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/templates", tags=["templates"])

@router.get(
    "/{type}",
    response_class=Response,
    summary="Download KRA CSV Template",
    description="Downloads the CSV template (with UTF-8 BOM encoding for Excel compatibility) required for Sales or Purchases reconciliation uploads. Contains headers and a fictional example row.",
)
def get_kra_template(
    type: ReconciliationType,
    current_user: User = Depends(get_current_user)
):
    csv_bytes = template_service.generate_template(type)
    
    filename = f"kra_{type.value}_template.csv"
    
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Cache-Control": "public, max-age=86400"
        }
    )
