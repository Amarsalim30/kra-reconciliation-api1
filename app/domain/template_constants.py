from app.schemas.invoice import ReconciliationType

TEMPLATE_HEADERS: dict[ReconciliationType, list[str]] = {
    ReconciliationType.SALES: [
        "Customer PIN",
        "Customer Name",
        "Invoice Number",
        "Invoice Date",
        "CU Number",
        "VAT Group",
        "Base Amount"
    ],
    ReconciliationType.PURCHASES: [
        "Supplier PIN",
        "Supplier Name",
        "Invoice Number",
        "Invoice Date",
        "CU Number",
        "VAT Group",
        "Base Amount"
    ]
}

TEMPLATE_EXAMPLES: dict[ReconciliationType, list[str]] = {
    ReconciliationType.SALES: [
        "P051234567A",
        "ABC Customer Limited",
        "INV-2026-0001",
        "2026-01-15",
        "CU00012345",
        "A16",
        "10000.00"
    ],
    ReconciliationType.PURCHASES: [
        "P059876543Z",
        "XYZ Supplier Limited",
        "SUP-2026-9999",
        "2026-01-20",
        "CU00098765",
        "A16",
        "25400.50"
    ]
}
