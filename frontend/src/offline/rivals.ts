import { outrankCount } from '../leaderboard/provisional'
import { rankEntries } from '../leaderboard/ranking'
import type { BadgeId, LeaderboardEntry, LeaderboardPeriod } from '../types/api'

/**
 * The Offline_Module's own 8 bundled Ghost_Rivals (D24). Each is flagged `is_seeded_rival`, so the board
 * labels it "Ghost Rival - demo". These are not real players and are not shared with the Mock_Adapter.
 */
interface Rival {
  id: string
  name: string
  level: number
  badges: readonly BadgeId[]
  all: { score: number; accuracy: number; streak: number }
  week: { score: number; accuracy: number; streak: number }
}

export const OFFLINE_RIVALS: readonly Rival[] = Object.freeze([
  { id: 'off-rival-1', name: 'Baroness Bytes', level: 9, badges: ['dungeon_master', 'boss_slayer', 'streak_5'], all: { score: 3900, accuracy: 0.95, streak: 16 }, week: { score: 2900, accuracy: 0.93, streak: 13 } },
  { id: 'off-rival-2', name: 'Sir Cache-a-Lot', level: 8, badges: ['boss_slayer', 'perfect_room'], all: { score: 3450, accuracy: 0.91, streak: 14 }, week: { score: 3200, accuracy: 0.92, streak: 14 } },
  { id: 'off-rival-3', name: 'Mother Mutex', level: 7, badges: ['boss_slayer', 'first_blood'], all: { score: 2950, accuracy: 0.87, streak: 11 }, week: { score: 1950, accuracy: 0.85, streak: 8 } },
  { id: 'off-rival-4', name: 'The Headless Heap', level: 6, badges: ['streak_5', 'first_blood'], all: { score: 2500, accuracy: 0.84, streak: 9 }, week: { score: 2550, accuracy: 0.86, streak: 10 } },
  { id: 'off-rival-5', name: 'Lord Latency', level: 5, badges: ['perfect_room', 'first_blood'], all: { score: 2100, accuracy: 0.8, streak: 7 }, week: { score: 1400, accuracy: 0.78, streak: 5 } },
  { id: 'off-rival-6', name: 'Packet Pete', level: 4, badges: ['first_blood'], all: { score: 1650, accuracy: 0.75, streak: 6 }, week: { score: 1800, accuracy: 0.79, streak: 7 } },
  { id: 'off-rival-7', name: 'Nibble the Nameless', level: 3, badges: ['first_blood'], all: { score: 1200, accuracy: 0.69, streak: 4 }, week: { score: 850, accuracy: 0.66, streak: 3 } },
  { id: 'off-rival-8', name: 'Little Lag', level: 2, badges: [], all: { score: 800, accuracy: 0.62, streak: 3 }, week: { score: 1050, accuracy: 0.7, streak: 4 } },
])

/** The 8 rivals as ranked board entries (ranks 1 to 8) for a period. */
export function rivalEntries(period: LeaderboardPeriod): LeaderboardEntry[] {
  return rankEntries(
    OFFLINE_RIVALS.map((r) => {
      const s = period === 'week' ? r.week : r.all
      return {
        id: r.id,
        rank: 0,
        display_name: r.name,
        is_guest: false,
        is_seeded_rival: true,
        level: r.level,
        score: s.score,
        accuracy: s.accuracy,
        best_streak: s.streak,
        badge_ids: [...r.badges],
      }
    }),
  )
}

/** Rank a finished run would hold among the rivals (1 plus the rivals that outrank it). */
export function rankAmongRivals(run: { score: number; accuracy: number; bestStreak: number }, name: string): number {
  return (
    outrankCount(rivalEntries('all'), {
      display_name: name,
      level: 1,
      score: run.score,
      accuracy: run.accuracy,
      best_streak: run.bestStreak,
    }) + 1
  )
}
