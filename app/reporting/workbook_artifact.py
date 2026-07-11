from dataclasses import dataclass


@dataclass(frozen=True)
class WorkbookArtifact:
    """A single serialized Excel workbook ready to be packed into a ZIP.

    zip_path: path inside the ZIP archive (e.g. "Details/05 Amount Mismatches.xlsx")
    filename: display filename (e.g. "05 Amount Mismatches.xlsx")
    content:  serialized openpyxl workbook bytes
    """

    zip_path:  str
    filename:  str
    content:   bytes
