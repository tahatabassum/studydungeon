from fastapi import APIRouter

from app.core.config import settings

health_router = APIRouter(tags=["Health"])


@health_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "ai_provider": settings.AI_PROVIDER,
    }

