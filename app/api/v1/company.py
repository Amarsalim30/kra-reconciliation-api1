from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_admin_user, get_current_user, get_db
from app.models.user import User
from app.schemas.company import CompanyResponse, CompanyUpdate
from app.services import company_service

router = APIRouter(prefix="/company", tags=["Company"])


@router.get("", response_model=CompanyResponse)
def get_company(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get company profile. Any authenticated user."""
    return company_service.get_or_create_company(db)


@router.put("", response_model=CompanyResponse)
def update_company(
    payload: CompanyUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Update company profile. Admin only."""
    try:
        return company_service.update_company(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
