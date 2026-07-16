from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String

from app.database.base import Base


class Company(Base):
    __tablename__ = "company"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name = Column(String(200), nullable=False, default="My Company")
    kra_pin = Column(String(50), nullable=True, comment="Company KRA PIN (e.g. P051234567Q)")
    timezone = Column(String(50), nullable=False, default="Africa/Nairobi")
    currency = Column(String(10), nullable=False, default="KES")
    fiscal_year_start_month = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Month (1-12) when the company fiscal year starts",
    )
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
