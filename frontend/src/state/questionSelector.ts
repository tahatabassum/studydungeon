/**
 * Question_Selector: pure helper that picks the next question id for a monster.
 *
 * Selection cycles through the pool in order: `pool[askedCount % pool.length]`.
 * `askedCount` is floored; negative, NaN or non-finite values are treated as 0.
 * Returns `undefined` for an empty pool.
 */
export function pickQuestionId(
  pool: readonly string[],
  askedCount: number,
): string | undefined {
  if (pool.length === 0) return undefined
  const n = Number.isFinite(askedCount) ? Math.floor(askedCount) : 0
  const index = (n > 0 ? n : 0) % pool.length
  return pool[index]
}
