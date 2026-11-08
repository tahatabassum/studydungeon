export type EntrySide = 'left' | 'right'

/**
 * Which side the character slides in from (D5): even room order from the left, odd from the right,
 * the boss always from the right. Pure and deterministic.
 */
export function entrySide(order: number, isBoss = false): EntrySide {
  if (isBoss) return 'right'
  return Math.abs(Math.trunc(order)) % 2 === 0 ? 'left' : 'right'
}
