from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_v1_router
from app.core.config import get_settings
from app.core.sap_client import SAPClient
from app.core.exceptions import SAPConnectionError, SAPQueryError, SAPConfigurationError
from app.reporting.registry import create_default_registry

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # SAP connections are now per-company; no global client is maintained.
    # Initialize export strategy registry
    app.state.export_registry = create_default_registry()
    
    # Validate parsing profiles on startup (Fail fast) and seed defaults if empty
    from app.database.database import SessionLocal
    from app.services.parsing_profile_service import ParsingProfileService
    with SessionLocal() as db:
        ParsingProfileService.seed_default_profiles(db)
        ParsingProfileService.get_profiles(db)
        
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)


@app.exception_handler(SAPConnectionError)
async def sap_connection_exception_handler(request: Request, exc: SAPConnectionError):
    return JSONResponse(
        status_code=502,
        content={"detail": f"SAP Service Layer Connection Error: {str(exc)}"},
    )


@app.exception_handler(SAPQueryError)
async def sap_query_exception_handler(request: Request, exc: SAPQueryError):
    return JSONResponse(
        status_code=400,
        content={"detail": f"SAP Query Error: {str(exc)}"},
    )


@app.exception_handler(SAPConfigurationError)
async def sap_config_exception_handler(request: Request, exc: SAPConfigurationError):
    return JSONResponse(
        status_code=500,
        content={"detail": f"SAP Configuration Error: {str(exc)}"},
    )



# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix="/api/v1")



@app.get("/")
async def root() -> dict[str, str]:
    return {
        "status": "running",
        "service": settings.app_name,
    }
