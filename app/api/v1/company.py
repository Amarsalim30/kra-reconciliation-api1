from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_admin_user, get_current_company, get_current_user, get_db
from app.models.user import User
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate
from app.services import company_service

router = APIRouter(prefix="/company", tags=["Company"])


@router.get("/me", response_model=CompanyResponse)
def get_my_company(
    company=Depends(get_current_company),
):
    """Get the authenticated user's own company profile."""
    return company


@router.get("/all", response_model=list[CompanyResponse])
def list_companies(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """List all registered companies. Platform admin only."""
    return company_service.list_companies(db)


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
def create_company(
    payload: CompanyCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Create a new company profile. Platform admin only."""
    try:
        return company_service.create_company(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{company_id}", response_model=CompanyResponse)
def get_company_by_id(
    company_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Get specific company details by ID. Platform admin only."""
    company = company_service.get_company_by_id(db, company_id)
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Company {company_id} not found")
    return company


@router.put("/{company_id}", response_model=CompanyResponse)
def update_company_by_id(
    company_id: int,
    payload: CompanyUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Update specific company profile by ID. Platform admin only."""
    try:
        return company_service.update_company_by_id(db, company_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Delete a company entity. Platform admin only."""
    try:
        company_service.delete_company(db, company_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
