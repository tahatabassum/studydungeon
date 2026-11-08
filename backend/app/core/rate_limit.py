import logging
from datetime import datetime, timedelta

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.all_models import RateLimitRecord

logger = logging.getLogger("studydungeon.security.proxy")


def get_client_ip(request: Request) -> str:
    """
    Extracts the client IP from the right side of the X-Forwarded-For header,
    counting TRUSTED_PROXY_COUNT hops back.
    Prevents leftmost client-controlled IP spoofing.
    """
    forwarded = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        proxy_count = getattr(settings, "TRUSTED_PROXY_COUNT", 1)
        if getattr(settings, "DEBUG", False):
            # Safe hop count logging without printing client IP or raw addresses
            logger.debug("Proxy hop check: total_hops=%d, configured_trusted_hops=%d", len(parts), proxy_count)
        if len(parts) >= proxy_count:
            # Entry that many hops from the RIGHT
            return parts[-proxy_count]
        return parts[0]
    return request.client.host if request.client else "127.0.0.1"


async def check_rate_limit(
    request: Request,
    db: AsyncSession,
    action: str,
    max_requests: int,
    window_seconds: int,
) -> None:
    ip = get_client_ip(request)
    key = f"{action}:{ip}"
    now = datetime.utcnow()
    window_start = now - timedelta(seconds=window_seconds)

    # 1. Count existing requests in window
    query = select(RateLimitRecord).where(
        RateLimitRecord.key == key,
        RateLimitRecord.timestamp >= window_start,
    )
    result = await db.execute(query)
    records = result.scalars().all()

    if len(records) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "RATE_LIMIT_EXCEEDED",
                "message": f"Too many requests for {action}. Please try again later.",
            },
        )

    # 2. Record this request
    record = RateLimitRecord(key=key, timestamp=now)
    db.add(record)
    await db.commit()
