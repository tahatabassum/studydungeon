/**
 * Pure light intensity function. Sum of three sines mapped into [min, max].
 * Reduced motion returns the constant midpoint. No allocation.
 */
export function flicker(timeMs: number, seed: number, min: number, max: number, reduced: boolean): number {
  if (reduced) return (min + max) / 2
  const t = timeMs / 1000
  const s = seed * 12.9898
  const n =
    (Math.sin(t * 7.3 + s) * 0.5 + Math.sin(t * 13.1 + s * 1.7) * 0.3 + Math.sin(t * 2.1 + s * 0.6) * 0.2 + 1) / 2
  const v = min + n * (max - min)
  return Math.min(Math.max(v, min), max)
}
