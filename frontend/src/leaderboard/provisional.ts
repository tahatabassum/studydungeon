import type { BadgeId, LeaderboardEntry } from '../types/api'
import { compareEntries, rankEntries } from './ranking'

/** Id of the player's own provisional row. */
export const PROVISIONAL_ID = 'me-provisional'

/** The player's run as the board needs it. */
export interface PlayerRun {
  display_name: string
  level: number
  score: number
  /** Ratio from 0 to 1. */
  accuracy: number
  best_streak: number
  badge_ids?: readonly BadgeId[]
  is_guest?: boolean
}

export function provisionalEntry(run: PlayerRun): LeaderboardEntry {
  return {
    id: PROVISIONAL_ID,
    rank: 0,
    display_name: run.display_name,
    is_guest: run.is_guest ?? true,
    is_seeded_rival: false,
    level: run.level,
    score: run.score,
    accuracy: run.accuracy,
    best_streak: run.best_streak,
    badge_ids: [...(run.badge_ids ?? [])],
  }
}

/**
 * Provisional rank (D12): inserts the run into the entries with the ranking comparator and renumbers.
 * Nothing is stored. The result is one entry longer, contains the run exactly once, and the run's rank
 * is 1 plus the number of existing entries that outrank it.
 */
export function insertProvisional(
  entries: readonly LeaderboardEntry[],
  run: PlayerRun,
): { entries: LeaderboardEntry[]; rank: number; entry: LeaderboardEntry } {
  const ranked = rankEntries([...entries, provisionalEntry(run)])
  const entry = ranked.find((e) => e.id === PROVISIONAL_ID)
  if (!entry) throw new Error('provisional entry missing')
  return { entries: ranked, rank: entry.rank, entry }
}

/** Number of entries that outrank the run (the pure definition of "rank minus one"). */
export function outrankCount(entries: readonly LeaderboardEntry[], run: PlayerRun): number {
  const probe = provisionalEntry(run)
  return entries.filter((e) => compareEntries(e, probe) < 0).length
}
