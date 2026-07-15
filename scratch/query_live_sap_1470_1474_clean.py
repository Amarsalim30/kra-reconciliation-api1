from app.core.sap_client import SAPClient

sap_client = SAPClient()
try:
    sap_client.login()
    print("Logged in successfully to SAP!")
    
    url = f"{sap_client.base_url}/PurchaseInvoices"
    
    for doc_num in (1470, 1474):
        resp = sap_client._execute_request_with_retry("GET", url, params={"$filter": f"DocNum eq {doc_num}"}, cookies=sap_client.cookies)
        print(f"\n=== DocNum {doc_num} ===")
        if resp.status_code == 200:
            val = resp.json().get("value", [])
            if val:
                doc = val[0]
                print(f"  NumAtCard: {doc.get('NumAtCard')}")
                print(f"  U_CUINV: {doc.get('U_CUINV')}")
                print(f"  U_CUSerial: {doc.get('U_CUSerial')}")
                print(f"  EDocNum: {doc.get('EDocNum')}")
                print(f"  PaymentReference: {doc.get('PaymentReference')}")
                print(f"  Comments: {doc.get('Comments')}")
                print(f"  Reference1: {doc.get('Reference1')}")
                print(f"  Reference2: {doc.get('Reference2')}")
                print(f"  CardName: {doc.get('CardName')}")
                print(f"  DocTotal: {doc.get('DocTotal')}")
            else:
                print("  Not found")
        else:
            print(f"  Error {resp.status_code}: {resp.text}")
except Exception as e:
    print(f"Error: {e}")
