from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.company import Company
from app.schemas.company import CompanyUpdate


def get_or_create_company(db: Session) -> Company:
    """Return the single Company row, creating it with defaults if absent."""
    company = db.query(Company).first()
    if company is None:
        company = Company()
        db.add(company)
        db.commit()
        db.refresh(company)
    return company


def update_company(db: Session, payload: CompanyUpdate) -> Company:
    company = get_or_create_company(db)
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
