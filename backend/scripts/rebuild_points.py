import asyncio
import logging

from sqlalchemy import func, select

from app.core.database import async_session_maker
from app.models.all_models import PlayerStats, PointEvent, User

logger = logging.getLogger("studydungeon.rebuild_points")


async def rebuild_points_ledger():
    """
    Recomputes PlayerStats and PlayerWeekStats from PointEvent ledger.
    Reports any discrepancies.
    """
    async with async_session_maker() as db:
        users = (await db.execute(select(User))).scalars().all()
        for u in users:
            # Sum all preloaded
            preloaded_sum = (
                await db.execute(
                    select(func.coalesce(func.sum(PointEvent.points), 0)).where(
                        PointEvent.user_id == u.id, PointEvent.board == "preloaded"
                    )
                )
            ).scalar_one()

            # Sum all own_notes
            own_notes_sum = (
                await db.execute(
                    select(func.coalesce(func.sum(PointEvent.points), 0)).where(
                        PointEvent.user_id == u.id, PointEvent.board == "own_notes"
                    )
                )
            ).scalar_one()

            overall_sum = preloaded_sum + own_notes_sum

            ps_res = await db.execute(select(PlayerStats).where(PlayerStats.user_id == u.id))
            ps = ps_res.scalar_one_or_none()
            if ps:
                if ps.points_overall != overall_sum:
                    print(f"Discrepancy for user {u.id}: DB overall {ps.points_overall} vs Ledger {overall_sum}")
                    ps.points_preloaded = preloaded_sum
                    ps.points_own_notes = own_notes_sum
                    ps.points_overall = overall_sum
                    await db.commit()
            else:
                if overall_sum > 0:
                    public_id = u.public_id or f"p_{u.id[:8]}"
                    new_ps = PlayerStats(
                        user_id=u.id,
                        public_id=public_id,
                        points_preloaded=preloaded_sum,
                        points_own_notes=own_notes_sum,
                        points_overall=overall_sum,
                    )
                    db.add(new_ps)
                    await db.commit()

        print("Points ledger rebuild complete.")


if __name__ == "__main__":
    asyncio.run(rebuild_points_ledger())

