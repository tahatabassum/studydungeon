import type { MasteryBand } from '../types/api'

/**
 * Display helpers for Mastery (D6). The Backend owns the value; this only labels it.
 * Weak below 50, Learning 50 to 79, Strong 80 and above (matches game-design.md).
 */
export const MASTERY_MIN = 0
export const MASTERY_MAX = 100
export const LEARNING_FROM = 50
export const STRONG_FROM = 80

export function clampMastery(value: number): number {
  if (!Number.isFinite(value)) return MASTERY_MIN
  return Math.min(MASTERY_MAX, Math.max(MASTERY_MIN, value))
}

export function masteryBand(value: number): MasteryBand {
  const v = clampMastery(value)
  if (v >= STRONG_FROM) return 'strong'
  if (v >= LEARNING_FROM) return 'learning'
  return 'weak'
}

export const MASTERY_BAND_LABEL: Record<MasteryBand, string> = {
  weak: 'Weak',
  learning: 'Learning',
  strong: 'Strong',
}
