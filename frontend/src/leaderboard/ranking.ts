import type { LeaderboardEntry } from '../types/api'

/** Code-point order, case-sensitive: the same result in every locale (determinism over politeness). */
function compareText(a: string, b: string): number {
  if (a === b) return 0
  const x = Array.from(a)
  const y = Array.from(b)
  const n = Math.min(x.length, y.length)
  for (let i = 0; i < n; i += 1) {
    const d = (x[i].codePointAt(0) ?? 0) - (y[i].codePointAt(0) ?? 0)
    if (d !== 0) return d
  }
  return x.length - y.length
}

/** The fields that decide a position. */
export type Rankable = Pick<LeaderboardEntry, 'id' | 'display_name' | 'score' | 'accuracy' | 'best_streak'>

/**
 * Total order (Req 11.5): score desc, accuracy desc, best streak desc, display name asc, then entry id asc.
 * Negative when `a` ranks ahead of `b`.
 */
export function compareEntries(a: Rankable, b: Rankable): number {
  if (a.score !== b.score) return b.score - a.score
  if (a.accuracy !== b.accuracy) return b.accuracy - a.accuracy
  if (a.best_streak !== b.best_streak) return b.best_streak - a.best_streak
  const byName = compareText(a.display_name, b.display_name)
  if (byName !== 0) return byName
  return compareText(a.id, b.id)
}

/** A new array in rank order with `rank` set to index plus one. Ties are fully broken, so ranks are unique. */
export function rankEntries(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort(compareEntries).map((entry, i) => ({ ...entry, rank: i + 1 }))
}
