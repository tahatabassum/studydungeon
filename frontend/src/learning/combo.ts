import { COMBO_TIER_NAMES, COMBO_TIER_STARTS, comboTier, type ComboTier } from '../game/fx/comboTier'

export { COMBO_TIER_NAMES, COMBO_TIER_STARTS, comboTier }
export type { ComboTier }

/** The number the Combo_Meter shows: the response `combo` when present, else the streak. */
export function comboValue(combo: number | undefined, streak: number): number {
  return Math.max(0, Math.floor(combo ?? streak))
}
