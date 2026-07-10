from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.sales import router as sales_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(sales_router)
