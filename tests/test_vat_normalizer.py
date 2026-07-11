import pytest
from app.services.vat_normalizer import VatNormalizer, DocumentType


class TestVatNormalizer:
    def setup_method(self):
        self.normalizer = VatNormalizer()

    def test_input_vat_purchase_i1(self):
        assert self.normalizer.normalize("sap", "purchases", "I1") == "16"

    def test_input_vat_purchase_i2(self):
        assert self.normalizer.normalize("sap", "purchases", "I2") == "0"

    def test_input_vat_purchase_i3(self):
        assert self.normalizer.normalize("sap", "purchases", "I3") == "8"

    def test_input_vat_purchase_x1(self):
        assert self.normalizer.normalize("sap", "purchases", "X1") == "EXEMPT"

    def test_output_vat_sales_o1(self):
        assert self.normalizer.normalize("sap", "sales", "O1") == "16"

    def test_output_vat_sales_o2(self):
        assert self.normalizer.normalize("sap", "sales", "O2") == "0"

    def test_output_vat_sales_x0(self):
        assert self.normalizer.normalize("sap", "sales", "X0") == "EXEMPT"

    def test_case_insensitive(self):
        assert self.normalizer.normalize("sap", "purchases", "i1") == "16"
        assert self.normalizer.normalize("sap", "sales", "o1") == "16"

    def test_unknown_code_passthrough(self):
        assert self.normalizer.normalize("sap", "purchases", "A16") == "A16"

    def test_already_normalized_value_passthrough(self):
        assert self.normalizer.normalize("sap", "purchases", "16") == "16"

    def test_empty_string(self):
        assert self.normalizer.normalize("sap", "purchases", "") == ""

    def test_whitespace_stripped(self):
        assert self.normalizer.normalize("sap", "purchases", " I1 ") == "16"

    def test_unknown_source_passthrough(self):
        assert self.normalizer.normalize("dynamics365", "purchases", "I1") == "I1"

    def test_custom_maps(self):
        custom = VatNormalizer(
            input_map={"I1": "VAT16", "I2": "VAT0"},
            output_map={"O1": "VAT16"},
        )
        assert custom.normalize("sap", "purchases", "I1") == "VAT16"
        assert custom.normalize("sap", "sales", "O1") == "VAT16"
