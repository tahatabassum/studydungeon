/**
 * Lightning scheduler (pure). Reuses the frontend-06 boss lightning limits: one flash per 8 s at a
 * peak overlay alpha of 0.25, and none under Reduced_Motion (Req 8.6, 8.5).
 */
import { LIGHTNING_MAX_ALPHA, LIGHTNING_MIN_GAP_MS } from './systems/pieceMotion'

export const LIGHTNING_SPACING_MS = LIGHTNING_MIN_GAP_MS
export const LIGHTNING_PEAK_ALPHA = LIGHTNING_MAX_ALPHA

/**
 * Earliest time the next flash may start: never before `last + 8000` and never before `now`;
 * Infinity under Reduced_Motion. `jitterMs` (>= 0) delays it further.
 */
export function nextLightningAt(now: number, last: number, reduced: boolean, jitterMs = 0): number {
  if (reduced) return Infinity
  return Math.max(now, last + LIGHTNING_SPACING_MS) + Math.max(0, jitterMs)
}
