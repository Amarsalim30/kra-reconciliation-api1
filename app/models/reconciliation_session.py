import uuid
from datetime import date, datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Date, JSON, Enum, Numeric, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.schemas.sales import InvoiceSource

class ReconciliationSession(Base):
    __tablename__ = "reconciliation_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_compared: Mapped[bool] = mapped_column(default=False, nullable=False)
    comparison_results: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    last_accessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    invoices: Mapped[list["SessionInvoice"]] = relationship(
        "SessionInvoice", back_populates="session", cascade="all, delete-orphan"
    )

class SessionInvoice(Base):
    __tablename__ = "session_invoices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("reconciliation_sessions.id", ondelete="CASCADE"), nullable=False)
    source: Mapped[InvoiceSource] = mapped_column(Enum(InvoiceSource, native_enum=False), nullable=False)
    pin: Mapped[str] = mapped_column(String(100), nullable=False)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    cu_number: Mapped[str] = mapped_column(String(100), nullable=False)
    vat_group: Mapped[int] = mapped_column(Integer, nullable=False)
    base_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    session: Mapped["ReconciliationSession"] = relationship("ReconciliationSession", back_populates="invoices")

    __table_args__ = (
        Index("ix_session_invoices_session_id", "session_id"),
        Index("ix_session_invoices_session_source", "session_id", "source"),
        Index("ix_session_invoices_session_cu", "session_id", "cu_number"),
    )
