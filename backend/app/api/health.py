from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

health_router = APIRouter(tags=["Health"])


@health_router.get("/health")
async def health_check():
    """
    Fast, DB-free health ping for reverse proxies, Docker healthchecks,
    and cold-start pollers.
    """
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "ai_provider": settings.AI_PROVIDER,
    }


@health_router.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """
    Readiness probe that checks database connectivity.
    """
    try:
        await db.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "database": "connected",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "DATABASE_UNAVAILABLE", "message": f"Database check failed: {str(e)}"},
        )

