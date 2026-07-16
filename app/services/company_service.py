from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.company import Company
from app.schemas.company import CompanyCreate, CompanyUpdate


def list_companies(db: Session) -> list[Company]:
    """Return all registered companies, ensuring at least one default company exists."""
    get_or_create_company(db)
    return db.query(Company).order_by(Company.id.asc()).all()


def get_or_create_company(db: Session) -> Company:
    """Return the primary Company row, creating it with defaults if absent."""
    company = db.query(Company).first()
    if company is None:
        company = Company()
        db.add(company)
        db.commit()
        db.refresh(company)
    return company


def create_company(db: Session, payload: CompanyCreate) -> Company:
    """Create a new company entity."""
    company = Company(
        name=payload.name,
        kra_pin=payload.kra_pin,
        timezone=payload.timezone,
        currency=payload.currency,
        fiscal_year_start_month=payload.fiscal_year_start_month,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def get_company_by_id(db: Session, company_id: int) -> Company | None:
    return db.query(Company).filter(Company.id == company_id).first()


def update_company_by_id(db: Session, company_id: int, payload: CompanyUpdate) -> Company:
    company = get_company_by_id(db, company_id)
    if company is None:
        raise ValueError(f"Company with ID {company_id} not found.")
    if payload.name is not None:
        company.name = payload.name
    if payload.kra_pin is not None:
        company.kra_pin = payload.kra_pin
    if payload.timezone is not None:
        company.timezone = payload.timezone
    if payload.currency is not None:
        company.currency = payload.currency
    if payload.fiscal_year_start_month is not None:
        company.fiscal_year_start_month = payload.fiscal_year_start_month
    company.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(company)
    return company


def update_company(db: Session, payload: CompanyUpdate) -> Company:
    """Backward compatible helper to update the primary company."""
    company = get_or_create_company(db)
    return update_company_by_id(db, company.id, payload)


def delete_company(db: Session, company_id: int) -> None:
    """Delete a company by ID, ensuring primary company (ID 1) cannot be deleted."""
    if company_id == 1:
        raise ValueError("The primary master company profile cannot be deleted.")
    company = get_company_by_id(db, company_id)
    if company is None:
        raise ValueError(f"Company with ID {company_id} not found.")
    db.delete(company)
    db.commit()

