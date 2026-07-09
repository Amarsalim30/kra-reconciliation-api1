from fastapi import FastAPI

from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "status": "running",
        "service": settings.app_name,
    }
