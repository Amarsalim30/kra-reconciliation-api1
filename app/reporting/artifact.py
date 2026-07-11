from dataclasses import dataclass
from io import BytesIO


@dataclass(frozen=True)
class ExportArtifact:
    """Final export output — filename, media type, and content bytes.

    frozen=True fixes the BytesIO *reference*, not the buffer contents.
    BytesIO is inherently mutable. Do not write to content after construction.
    """

    filename:   str       # full filename including timestamp and extension
    media_type: str       # "application/zip", "application/pdf", etc.
    content:    BytesIO   # seeked to 0
