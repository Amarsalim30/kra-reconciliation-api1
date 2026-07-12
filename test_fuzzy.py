import difflib
import re

def normalize(name):
    n = name.upper()
    n = re.sub(r'\(K\)', ' KENYA ', n)
    n = re.sub(r'[^A-Z0-9]', ' ', n)
    words = n.split()
    suffixes = {"LIMITED", "LTD", "COMPANY", "CO", "PLC", "INC", "LLC"}
    words = [w for w in words if w not in suffixes]
    return " ".join(words)

pairs = [
    ("Aspendos Diary Limited", "Aspendos Dairy Limited"),
    ("Mitchell Cotts Freight Kenya Ltd", "MITCHELL COTTS FREIGHT (K) LTD"),
    ("Gulf Power", "AGRICHEM AFRICA LIMITED")
]

for sap, kra in pairs:
    n_sap = normalize(sap)
    n_kra = normalize(kra)
    ratio = difflib.SequenceMatcher(None, n_sap, n_kra).ratio()
    match = ratio >= 0.85
    print(f"'{sap}' vs '{kra}' -> '{n_sap}' vs '{n_kra}' | Ratio: {ratio:.2f} | Match: {match}")
