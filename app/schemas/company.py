from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200, description="Company legal name")
    kra_pin: Optional[str] = Field(default=None, max_length=50, description="Company KRA PIN e.g. P051234567Q")
    timezone: Optional[str] = Field(default=None, max_length=50, description="IANA timezone e.g. Africa/Nairobi")
    currency: Optional[str] = Field(default=None, max_length=10, description="ISO currency code e.g. KES")
    fiscal_year_start_month: Optional[int] = Field(
        default=None, ge=1, le=12, description="Month (1-12) when the fiscal year starts"
    )


class CompanyResponse(BaseModel):
    id: int
    name: str
    kra_pin: str | None = None
    timezone: str
    currency: str
    fiscal_year_start_month: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
