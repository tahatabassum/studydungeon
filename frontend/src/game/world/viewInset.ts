/** Max fraction of the view the docked question panel may cover. */
export const MAX_VIEW_INSET = 0.45

/** Clamp a bottom-inset fraction to [0, MAX_VIEW_INSET]; NaN/Infinity-safe. */
export function clampViewInset(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(MAX_VIEW_INSET, Math.max(0, n))
}
