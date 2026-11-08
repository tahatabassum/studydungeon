/** Typewriter speed (D6). */
export const TYPEWRITER_RATE = 45

/**
 * Number of characters shown. Pure: an integer in [0, length], non-decreasing in elapsedMs,
 * and the full length when skipped or under reduced motion.
 */
export function visibleChars(
  length: number,
  rate: number,
  elapsedMs: number,
  skip: boolean,
  reduced: boolean,
): number {
  const len = Math.max(0, Math.floor(Number.isFinite(length) ? length : 0))
  if (skip || reduced) return len
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0
  const r = Number.isFinite(rate) ? Math.max(0, rate) : 0
  return Math.min(len, Math.max(0, Math.floor((elapsed * r) / 1000)))
}
