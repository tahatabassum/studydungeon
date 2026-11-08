from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_maker
from app.models.all_models import RateLimitRecord, User


async def purge_expired_guests(session: Optional[AsyncSession] = None) -> int:
    """
    1. Deletes all guest users whose expires_at is earlier than now().
       NEVER deletes system users (is_guest=False).
    2. Cleans RateLimitRecord rows older than 1 hour.
    Returns the count of purged guests.
    """
    now = datetime.utcnow()

    async def _do_purge(sess: AsyncSession) -> int:
        stmt_guests = delete(User).where(User.is_guest == True, User.expires_at < now)
        res_guests = await sess.execute(stmt_guests)

        stale_threshold = now - timedelta(hours=1)
        stmt_limits = delete(RateLimitRecord).where(RateLimitRecord.timestamp < stale_threshold)
        await sess.execute(stmt_limits)

        await sess.commit()
        count = res_guests.rowcount
        print(f"[{now.isoformat()}] Purged {count} expired guest user(s).")
        return count

    if session is not None:
        return await _do_purge(session)

    async with async_session_maker() as sess:
        return await _do_purge(sess)


if __name__ == "__main__":
    import asyncio
    import sys
    count = asyncio.run(purge_expired_guests())
    sys.exit(0)
