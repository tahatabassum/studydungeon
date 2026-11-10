import type { ProgressInfo } from '../types/api'

/**
 * MOCK-AND-OFFLINE-ONLY level formula (pending Person A's game-design.md; the real backend owns this).
 * Level 1 at 0 XP; reaching level n+1 from level n costs 100 * n XP
 * (100 XP for L2, +200 for L3, +300 for L4, ...). `xp_to_next` is always > 0.
 */
export function progressFromXp(totalXp: number): Pick<ProgressInfo, 'level' | 'total_xp' | 'xp_to_next'> {
  let level = 1
  let remaining = Math.max(0, totalXp)
  while (remaining >= 100 * level) {
    remaining -= 100 * level
    level += 1
  }
  return { level, total_xp: Math.max(0, totalXp), xp_to_next: 100 * level - remaining }
}
