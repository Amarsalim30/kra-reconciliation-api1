import pytest
from unittest.mock import patch


@pytest.fixture(autouse=True)
def mock_sap_client(request):
    if "test_sap_integration" in request.node.nodeid:
        yield None, None
        return

    mock_data = [
        {
            "FederalTaxID": "P051393568M",
            "CardName": "Autoports Freight Terminals Limited",
            "DocNum": 1080,
            "DocDate": "2026-03-02T00:00:00Z",
            "U_CUINV": "|0190439340000000455",
            "DocumentLines": [
                {
                    "VatGroup": "16.0",
                    "LineTotal": 1118894.84
                }
            ]
        },
        {
            "FederalTaxID": "P051137818X",
            "CardName": "GRAIN INDUSTRIES LIMITED",
            "DocNum": 1081,
            "DocDate": "2026-03-11T00:00:00Z",
            "U_CUINV": " |0190439340000000456  ",
            "DocumentLines": [
                {
                    "VatGroup": "16.0",
                    "LineTotal": 3977701.88
                }
            ]
        },
        {
            "FederalTaxID": "P051352116L",
            "CardName": "Aspendos Dairy Limited",
            "DocNum": 1082,
            "DocDate": "2026-03-12T00:00:00Z",
            "U_CUINV": "|0190439340000000457",
            "DocumentLines": [
                {
                    "VatGroup": "16",
                    "LineTotal": 1263600
                }
            ]
        },
        {
            "FederalTaxID": "P051317852J",
            "CardName": "MAU FLORA LIMITED",
            "DocNum": 1083,
            "DocDate": "2026-03-12T00:00:00Z",
            "U_CUINV": "|0190439340000000459",
            "DocumentLines": [
                {
                    "VatGroup": "16",
                    "LineTotal": 105000.00
                }
            ]
        },
        {
            "FederalTaxID": "P051430208L",
            "CardName": "BIG FLOWERS PLC",
            "DocNum": 1084,
            "DocDate": "2026-03-12T00:00:00Z",
            "U_CUINV": "|0190439340000000460",
            "DocumentLines": [
                {
                    "VatGroup": "0",
                    "LineTotal": 105000
                }
            ]
        }
    ]

    with patch("app.core.sap_client.SAPClient.login") as mock_login, \
         patch("app.core.sap_client.SAPClient.get_documents_pages") as mock_get_pages:
        mock_login.return_value = None
        
        def mock_get_pages_side_effect(from_date, to_date, endpoint_name, *args, **kwargs):
            if endpoint_name == "Invoices":
                return (p for p in [mock_data])
            return (p for p in [[]])
            
        mock_get_pages.side_effect = mock_get_pages_side_effect
        yield mock_login, mock_get_pages
