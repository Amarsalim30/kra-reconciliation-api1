from app.services.normalization import normalize_partner_name, normalize_pin

def run_tests():
    # Partner Name tests
    assert normalize_partner_name("Kitui Flour Mills") == normalize_partner_name("KITUI FLOUR MILLS LIMITED"), "Failed: Kitui Flour Mills"
    assert normalize_partner_name("ABC CO.") == normalize_partner_name("ABC COMPANY"), "Failed: ABC CO."
    assert normalize_partner_name("ABC PLC") == normalize_partner_name("ABC PLC"), "Failed: ABC PLC"
    assert normalize_partner_name("Mau Flora") != normalize_partner_name("Big Flowers"), "Failed: Mau Flora"
    assert normalize_partner_name("A&B") == "A B", "Failed: A&B"
    
    # PIN tests
    assert normalize_pin("P051129478N") == "P051129478N", "Failed PIN 1"
    assert normalize_pin(" P 05 11 29 47 8 N ") == "P051129478N", "Failed PIN 2"
    assert normalize_pin("p051129478n") == "P051129478N", "Failed PIN 3"
    
    print("All normalization tests passed!")

if __name__ == "__main__":
    run_tests()
