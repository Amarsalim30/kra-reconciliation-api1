import json
from datetime import date
from pathlib import Path
from app.schemas.sales import SalesInvoice
from app.services.normalization import normalize_invoice_data

def get_sales_invoices(from_date: date, to_date: date) -> list[SalesInvoice]:
    """
    Reads mock raw SAP data from json fixture, filters it by date range,
    normalizes it to SalesInvoice schema, and returns the list.
    """
    current_dir = Path(__file__).resolve().parent
    mock_file_path = current_dir.parent / "mock_data" / "sap_sales.json"
    
    if not mock_file_path.exists():
        return []
        
    with open(mock_file_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
        
    invoices = []
    for raw_item in raw_data:
        try:
            normalized = normalize_invoice_data(
                pin=raw_item.get("PIN"),
                customer_name=raw_item.get("Customer Name"),
                invoice_number=raw_item.get("Invoice Number"),
                invoice_date=raw_item.get("Invoice Date"),
                cu_number=raw_item.get("CU Number"),
                vat_group=raw_item.get("VAT Group"),
                base_amount=raw_item.get("Base Amount")
            )
            invoice = SalesInvoice(**normalized)
            if from_date <= invoice.invoice_date <= to_date:
                invoices.append(invoice)
        except ValueError:
            # Skip invalid mock entries in the fixture if any
            continue
            
    return invoices
