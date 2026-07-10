from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_v1_router
from app.core.config import get_settings
from app.core.sap_client import SAPClient

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SAP client on app state for dependency injection
    app.state.sap_client = SAPClient()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
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
