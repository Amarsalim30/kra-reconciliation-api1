from fastapi import FastAPI

from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
)


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "status": "running",
        "service": settings.APP_NAME,
    }
