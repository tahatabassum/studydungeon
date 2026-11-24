import { z } from 'zod'
import type { ProgressInfo, WeaponId } from '../../types/api'
import { WEAPONS, weaponIdFromName } from '../../weapons/weapons'

/** `GET /progress` (C14). `unlocked_weapons` holds weapon names. */
export const wireProgressSchema = z.object({
  user_id: z.string().optional(),
  level: z.number().int().min(1),
  total_xp: z.number().int().nonnegative(),
  unlocked_weapons: z.array(z.string()),
  // Added with the Daily Haunt (absent on old backends).
  xp_to_next: z.number().int().nonnegative().optional(),
  daily_streak: z.number().int().nonnegative().optional(),
  due_review_count: z.number().int().nonnegative().optional(),
  next_due_at: z.string().nullish(),
})

export type WireProgress = z.output<typeof wireProgressSchema>

/** Weapon ids the backend reports as unlocked (unknown names are ignored). */
export function unlockedWeaponIds(w: WireProgress): WeaponId[] {
  const ids: WeaponId[] = []
  for (const name of w.unlocked_weapons) {
    const id = weaponIdFromName(name)
    if (id !== undefined && !ids.includes(id)) ids.push(id)
  }
  // The starter weapon is always available even if the list is empty.
  if (!ids.includes('rusty_dagger')) ids.unshift('rusty_dagger')
  return ids
}

/**
 * xp_to_next is passed on when the backend sends it (the HUD falls back to total XP). The Armory list marks a weapon unlocked by
 * giving it unlock_level 1 and a locked one level + 1, with the real rule as its requirement text.
 */
export function mapProgress(w: WireProgress): ProgressInfo {
  const unlocked = unlockedWeaponIds(w)
  return {
    level: w.level,
    total_xp: w.total_xp,
    ...(w.xp_to_next !== undefined ? { xp_to_next: w.xp_to_next } : {}),
    ...(w.due_review_count !== undefined ? { due_review_count: w.due_review_count } : {}),
    unlocked_weapons: unlocked,
    weapons: WEAPONS.map((x) => ({
      id: x.id,
      unlock_level: unlocked.includes(x.id) ? 1 : w.level + 1,
      requirement: x.requirement,
    })),
  }
}
