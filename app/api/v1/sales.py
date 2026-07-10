from datetime import date
from fastapi import APIRouter, Depends, Query, UploadFile

from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.sales import SalesFetchResponse, SalesUploadResponse
from app.services import sap_service, kra_service

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("", response_model=SalesFetchResponse)
def get_sales(
    from_date: date = Query(..., alias="from", description="Start date (YYYY-MM-DD)"),
    to_date: date = Query(..., alias="to", description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch sales invoices within a given date range. Currently returns normalized mock SAP data.
    """
    invoices = sap_service.get_sales_invoices(from_date, to_date)
    return SalesFetchResponse(
        source="SAP",
        count=len(invoices),
        from_date=from_date,
        to_date=to_date,
        invoices=invoices
    )


@router.post("/upload", response_model=SalesUploadResponse)
def upload_sales_csv(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
):
    """
    Upload a KRA CSV file containing sales invoices. Returns successfully parsed records and aggregate errors.
    """
    return kra_service.parse_kra_csv(file)
