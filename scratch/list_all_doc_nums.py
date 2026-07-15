import json

with open("data/payload.json", "r") as f:
    data = json.load(f)

doc_nums = [doc.get("DocNum") for doc in data["value"]]
print(f"All DocNums in payload.json: {sorted(doc_nums)}")
