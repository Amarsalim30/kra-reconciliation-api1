import csv
import io
from app.schemas.invoice import ReconciliationType
from app.domain.template_constants import TEMPLATE_HEADERS, TEMPLATE_EXAMPLES

def generate_template(template_type: ReconciliationType) -> bytes:
    """
    Generates a CSV template as a bytes object encoded in utf-8-sig (with UTF-8 BOM).
    Includes the headers and a single mock example row representing typical values.
    """
    headers = TEMPLATE_HEADERS.get(template_type, [])
    example = TEMPLATE_EXAMPLES.get(template_type, [])
    
    # We output to a string buffer using standard python csv library
    output = io.StringIO()
    writer = csv.writer(output, lineterminator='\r\n')
    writer.writerow(headers)
    writer.writerow(example)
    
    csv_data = output.getvalue()
    output.close()
    
    # utf-8-sig adds the BOM (Byte Order Mark) at the start for Excel compatibility
    return csv_data.encode('utf-8-sig')
