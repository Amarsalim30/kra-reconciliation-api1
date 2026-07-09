from fastapi import FastAPI

from app.api.auth import router as auth_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
)

app.include_router(auth_router)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "status": "running",
        "service": settings.app_name,
    }
