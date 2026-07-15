from app.core.sap_client import SAPClient
import json

sap_client = SAPClient()
try:
    sap_client.login()
    print("Logged in successfully to SAP!")
    
    # 1. Fetch DocNum 1470
    url_1470 = f"{sap_client.base_url}/PurchaseInvoices"
    params_1470 = {"$filter": "DocNum eq 1470"}
    resp_1470 = sap_client._execute_request_with_retry("GET", url_1470, params=params_1470, cookies=sap_client.cookies)
    print("\n--- DocNum 1470 Raw SAP Data ---")
    if resp_1470.status_code == 200:
        val_1470 = resp_1470.json().get("value", [])
        if val_1470:
            doc = val_1470[0]
            print(f"NumAtCard: {doc.get('NumAtCard')}")
            print(f"U_CUINV: {doc.get('U_CUINV')}")
            print(f"U_CUSerial: {doc.get('U_CUSerial')}")
            print(f"EDocNum: {doc.get('EDocNum')}")
            print(f"PaymentReference: {doc.get('PaymentReference')}")
            print(f"Comments: {doc.get('Comments')}")
            print(f"Reference1: {doc.get('Reference1')}")
            print(f"Reference2: {doc.get('Reference2')}")
            # print all populated fields
            print("Populated fields:")
            for k, v in doc.items():
                if v is not None and v != "" and v != []:
                    print(f"  {k}: {v}")
        else:
            print("Not found")
    else:
        print(f"Error {resp_1470.status_code}: {resp_1470.text}")
        
    # 2. Fetch DocNum 1474
    params_1474 = {"$filter": "DocNum eq 1474"}
    resp_1474 = sap_client._execute_request_with_retry("GET", url_1470, params=params_1474, cookies=sap_client.cookies)
    print("\n--- DocNum 1474 Raw SAP Data ---")
    if resp_1474.status_code == 200:
        val_1474 = resp_1474.json().get("value", [])
        if val_1474:
            doc = val_1474[0]
            print(f"NumAtCard: {doc.get('NumAtCard')}")
            print(f"U_CUINV: {doc.get('U_CUINV')}")
            print(f"U_CUSerial: {doc.get('U_CUSerial')}")
            print(f"EDocNum: {doc.get('EDocNum')}")
            print(f"PaymentReference: {doc.get('PaymentReference')}")
            print(f"Comments: {doc.get('Comments')}")
            print(f"Reference1: {doc.get('Reference1')}")
            print(f"Reference2: {doc.get('Reference2')}")
            # print all populated fields
            print("Populated fields:")
            for k, v in doc.items():
                if v is not None and v != "" and v != []:
                    print(f"  {k}: {v}")
        else:
            print("Not found")
    else:
        print(f"Error {resp_1474.status_code}: {resp_1474.text}")
except Exception as e:
    print(f"Error: {e}")
