/** Pure room-transition plan (no Phaser). Display only. */
export const TRANSITION_MAX_MS = 600
export const TRANSITION_MS = 560
export const MIST_BLOBS = 6
const STAGGER_MS = 20

export interface TransitionPlan {
  /** Total time until the last blob finishes; never above TRANSITION_MAX_MS. */
  totalMs: number
  blobs: number
  /** Per-blob sweep duration. */
  sweepMs: number
  /** Delay before blob i starts. */
  delayMs: (i: number) => number
}

/** Returns null when the transition must not play (reduced motion). */
export function transitionPlan(reduced: boolean): TransitionPlan | null {
  if (reduced) return null
  const sweepMs = TRANSITION_MS - (MIST_BLOBS - 1) * STAGGER_MS
  return {
    totalMs: Math.min(TRANSITION_MAX_MS, sweepMs + (MIST_BLOBS - 1) * STAGGER_MS),
    blobs: MIST_BLOBS,
    sweepMs,
    delayMs: (i) => i * STAGGER_MS,
  }
}
