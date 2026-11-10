import { fnv1a, rngFromSeed } from './seededRng'

/** Smallest and largest draw (D4): `6 + (hash mod 3)`. */
export const MIN_DRAW = 6
export const MAX_DRAW = 8

/** Number of questions to draw for a seed, limited to the pool size. */
export function drawSize(runSeed: string, poolSize: number): number {
  return Math.min(poolSize, MIN_DRAW + (fnv1a(runSeed) % 3))
}

/**
 * MOCK-ONLY (D3, D4): draws `drawSize` distinct items from the pool with a partial Fisher-Yates
 * shuffle. Deterministic for a seed and pool; the input array is not changed.
 */
export function drawQuestions<T>(pool: readonly T[], runSeed: string): T[] {
  const size = drawSize(runSeed, pool.length)
  const items = [...pool]
  const rnd = rngFromSeed(runSeed)
  for (let i = 0; i < size; i += 1) {
    const j = i + Math.floor(rnd() * (items.length - i))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
  return items.slice(0, size)
}
