from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user_optional
from app.models.all_models import ContentPack, Dungeon, GameRun, PointEvent, User
from app.schemas.packs import PackItem, PacksResponse
from app.services.progression import DungeonProgress, floor_ids_in_order, load_progress

packs_router = APIRouter(tags=["packs"])


@packs_router.get("/packs", response_model=PacksResponse)
async def list_packs(
    user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    # Fetch all published content packs ordered by order index
    res = await db.execute(
        select(ContentPack)
        .options(selectinload(ContentPack.dungeon).selectinload(Dungeon.rooms))
        .order_by(ContentPack.order.asc())
    )
    packs = res.scalars().all()

    # A pack is completed when its final boss is defeated; cleared floors and active runs make it in progress.
    progress = await load_progress(db, user.id, [p.dungeon_id for p in packs if p.dungeon_id]) if user else {}

    pack_items = []
    unlocked = True  # Pack 1 is always unlocked
    next_pack_id = None
    all_completed = True if packs else False

    for idx, pack in enumerate(packs):
        prog = progress.get(pack.dungeon_id) or DungeonProgress()
        floor_ids = floor_ids_in_order(pack.dungeon.rooms) if pack.dungeon else []
        is_completed = prog.final_boss_cleared
        real_floors_cleared = prog.floors_cleared(floor_ids)
        is_active = prog.has_active_run or real_floors_cleared > 0

        if not is_completed:
            all_completed = False

        if unlocked:
            if is_completed:
                p_status = "completed"
                floors_cleared = pack.floors_total
                fb_cleared = True
            elif is_active:
                p_status = "in_progress"
                floors_cleared = min(real_floors_cleared, pack.floors_total)
                fb_cleared = False
            else:
                p_status = "available"
                floors_cleared = 0
                fb_cleared = False
        else:
            p_status = "locked"
            floors_cleared = 0
            fb_cleared = False

        if p_status != "completed" and next_pack_id is None and p_status != "locked":
            next_pack_id = pack.id

        # Determine points earned on this pack by user
        pack_points = 0
        if user:
            pack_runs_subq = select(GameRun.id).where(GameRun.user_id == user.id, GameRun.dungeon_id == pack.dungeon_id)
            pts_res = await db.execute(
                select(func.coalesce(func.sum(PointEvent.points), 0)).where(
                    PointEvent.user_id == user.id,
                    PointEvent.run_id.in_(pack_runs_subq)
                )
            )
            pack_points = pts_res.scalar_one()

        pack_items.append(
            PackItem(
                id=pack.id,
                order=pack.order,
                title=pack.title,
                description=pack.description,
                dungeon_id=pack.dungeon_id,
                floors_total=pack.floors_total,
                floors_cleared=floors_cleared,
                final_boss_cleared=fb_cleared,
                status=p_status,
                points_earned=pack_points,
            )
        )

        # Next pack unlocks only if this pack is completed
        unlocked = is_completed

    return PacksResponse(
        packs=pack_items,
        next_pack_id=next_pack_id,
        all_completed=all_completed,
    )

