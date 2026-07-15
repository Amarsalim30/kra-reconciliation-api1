import json

with open("data/payload.json", "r") as f:
    data = json.load(f)

print("All documents in payload.json:")
for doc in data["value"]:
    print(f"  DocEntry: {doc.get('DocEntry')}, DocNum: {doc.get('DocNum')}, CardName: {doc.get('CardName')}, NumAtCard: {doc.get('NumAtCard')}, U_CUINV: {doc.get('U_CUINV')}")
