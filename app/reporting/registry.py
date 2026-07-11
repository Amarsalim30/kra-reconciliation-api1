from app.reporting.errors import UnsupportedExportFormatError
from app.reporting.export_format import ExportFormat
from app.reporting.strategies.base import ExportStrategy
from app.reporting.strategies.zip_strategy import ZipExporter


class ExportStrategyRegistry:
    def __init__(self) -> None:
        self._strategies: dict[ExportFormat, ExportStrategy] = {}

    def register(self, fmt: ExportFormat, strategy: ExportStrategy) -> None:
        self._strategies[fmt] = strategy

    def get(self, fmt: ExportFormat) -> ExportStrategy:
        if fmt not in self._strategies:
            raise UnsupportedExportFormatError(
                f"No export strategy registered for format '{fmt.value}'. "
                f"Available: {[f.value for f in self._strategies]}"
            )
        return self._strategies[fmt]


def create_default_registry() -> ExportStrategyRegistry:
    """Factory — no module-level globals. Call once at application startup.

    Registered in the FastAPI lifespan event:
        @asynccontextmanager
        async def lifespan(app: FastAPI):
            app.state.export_registry = create_default_registry()
            yield

    The export endpoint retrieves it via:
        registry: ExportStrategyRegistry = request.app.state.export_registry

    This ensures a single registry instance per application process and makes
    DI / test overrides straightforward.
    """
    reg = ExportStrategyRegistry()
    reg.register(ExportFormat.ZIP, ZipExporter())
    return reg
