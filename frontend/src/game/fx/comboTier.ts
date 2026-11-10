/**
 * Pure combo tiers (D8). Lives in src/game/fx so both Phaser (aura tint) and the HUD can import it;
 * src/learning re-exports it. Display only: the streak is the Backend's.
 */
export type ComboTier = 0 | 1 | 2 | 3 | 4

/** Streak at which each tier starts: Combo, Hot, Blazing, Legendary. */
export const COMBO_TIER_STARTS: readonly [number, number, number, number] = [3, 5, 8, 12]

export const COMBO_TIER_NAMES: readonly string[] = ['', 'Combo', 'Hot', 'Blazing', 'Legendary']

/** Non-decreasing in the streak; 0 below 3, then 1, 2, 3, 4 at 3, 5, 8 and 12. Bad input gives 0. */
export function comboTier(streak: number): ComboTier {
  if (!Number.isFinite(streak)) return 0
  if (streak >= COMBO_TIER_STARTS[3]) return 4
  if (streak >= COMBO_TIER_STARTS[2]) return 3
  if (streak >= COMBO_TIER_STARTS[1]) return 2
  if (streak >= COMBO_TIER_STARTS[0]) return 1
  return 0
}
