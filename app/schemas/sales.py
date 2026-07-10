from datetime import date
from decimal import Decimal
from pydantic import BaseModel, field_serializer

class SalesInvoice(BaseModel):
    pin: str
    customer_name: str
    invoice_number: str
    invoice_date: date
    cu_number: str
    vat_group: int
    base_amount: Decimal

    @field_serializer("base_amount")
    def serialize_base_amount(self, base_amount: Decimal) -> float:
        return float(base_amount)

class SalesFetchResponse(BaseModel):
    source: str
    count: int
    from_date: date
    to_date: date
    invoices: list[SalesInvoice]

class CSVValidationErrorDetail(BaseModel):
    row: int
    column: str | None = None
    message: str

class SalesUploadResponse(BaseModel):
    filename: str
    rows: int
    parsed: int
    errors_count: int
    errors: list[CSVValidationErrorDetail]
    invoices: list[SalesInvoice]
