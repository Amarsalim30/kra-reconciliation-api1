from app.services.normalization import normalize_partner_name, normalize_pin

sap_p = normalize_partner_name("Gulf Power")
kra_p = normalize_partner_name("AGRICHEM AFRICA LIMITED")
print("Partner name matches:", sap_p == kra_p, f"({sap_p} == {kra_p})")

sap_pin = normalize_pin("P051303453V")
kra_pin = normalize_pin("P051421525N")
print("PIN matches:", sap_pin == kra_pin, f"({sap_pin} == {kra_pin})")
