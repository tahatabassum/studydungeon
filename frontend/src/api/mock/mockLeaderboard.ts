import { outrankCount } from '../../leaderboard/provisional'
import { rankEntries } from '../../leaderboard/ranking'
import type { BadgeId, LeaderboardEntry, LeaderboardPeriod, LeaderboardResponse } from '../../types/api'

/**
 * MOCK-ONLY leaderboard (D24, PROPOSED): 8 seeded Ghost Rivals plus the player's finished runs. The real
 * backend has no leaderboard endpoint yet; nothing here is imported outside the Mock_Adapter.
 */
interface RivalSeed {
  id: string
  name: string
  level: number
  badges: BadgeId[]
  all: { score: number; accuracy: number; streak: number }
  /** Stats for "This week". */
  week: { score: number; accuracy: number; streak: number }
}

export const RIVAL_SEEDS: readonly RivalSeed[] = Object.freeze([
  { id: 'rival-1', name: 'Lady Lantern', level: 9, badges: ['dungeon_master', 'no_damage', 'boss_slayer', 'streak_5'], all: { score: 4200, accuracy: 0.96, streak: 18 }, week: { score: 3100, accuracy: 0.94, streak: 14 } },
  { id: 'rival-2', name: 'Count Quill', level: 8, badges: ['boss_slayer', 'perfect_room', 'streak_5'], all: { score: 3650, accuracy: 0.92, streak: 15 }, week: { score: 3400, accuracy: 0.93, streak: 15 } },
  { id: 'rival-3', name: 'Sir Rattles', level: 7, badges: ['boss_slayer', 'first_blood'], all: { score: 3100, accuracy: 0.88, streak: 12 }, week: { score: 2050, accuracy: 0.86, streak: 9 } },
  { id: 'rival-4', name: 'Madam Hex', level: 6, badges: ['streak_5', 'memory_keeper', 'first_blood'], all: { score: 2650, accuracy: 0.85, streak: 10 }, week: { score: 2700, accuracy: 0.87, streak: 11 } },
  { id: 'rival-5', name: 'Wraith Wren', level: 5, badges: ['perfect_room', 'first_blood'], all: { score: 2200, accuracy: 0.81, streak: 8 }, week: { score: 1500, accuracy: 0.79, streak: 6 } },
  { id: 'rival-6', name: 'Pumpkin Pete', level: 4, badges: ['first_blood'], all: { score: 1750, accuracy: 0.76, streak: 6 }, week: { score: 1900, accuracy: 0.8, streak: 7 } },
  { id: 'rival-7', name: 'Bram Batwing', level: 3, badges: ['first_blood'], all: { score: 1300, accuracy: 0.7, streak: 5 }, week: { score: 900, accuracy: 0.68, streak: 4 } },
  { id: 'rival-8', name: 'Grim Gus', level: 2, badges: [], all: { score: 850, accuracy: 0.64, streak: 3 }, week: { score: 1100, accuracy: 0.72, streak: 4 } },
] as const)

/** A run the mock stored for the player. */
export interface StoredRun {
  id: string
  dungeonId: string
  score: number
  accuracy: number
  bestStreak: number
  finishedAt: number
}

export interface LeaderboardInput {
  dungeonId: string
  demoDungeonId: string
  period: LeaderboardPeriod
  limit: number
  runs: readonly StoredRun[]
  playerName: string
  playerLevel: number
  badges: readonly BadgeId[]
  /** A guest's runs are not stored on the Demo_Board (they are only ranked provisionally). */
  isGuest: boolean
  nowMs: number
  updatedAt: string
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function rivalEntries(period: LeaderboardPeriod): LeaderboardEntry[] {
  return RIVAL_SEEDS.map((r) => {
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
  })
}

/** The player's best run in the window, as a board entry. */
function playerEntry(run: StoredRun, input: LeaderboardInput, id: string): LeaderboardEntry {
  return {
    id,
    rank: 0,
    display_name: input.playerName,
    is_guest: input.isGuest,
    is_seeded_rival: false,
    level: input.playerLevel,
    score: run.score,
    accuracy: run.accuracy,
    best_streak: run.bestStreak,
    badge_ids: [...input.badges],
  }
}

function inWindow(run: StoredRun, input: LeaderboardInput): boolean {
  return input.period === 'all' || input.nowMs - run.finishedAt <= WEEK_MS
}

function bestRuns(runs: readonly StoredRun[]): StoredRun[] {
  return [...runs].sort((a, b) => b.score - a.score || b.accuracy - a.accuracy || b.bestStreak - a.bestStreak)
}

/**
 * Builds the board. The Demo_Board is rivals plus (for a player who is not a guest) the best run; a personal
 * dungeon shows only the player's own best runs (Req 11.2).
 */
export function buildMockLeaderboard(input: LeaderboardInput): LeaderboardResponse {
  const limit = Math.max(1, Math.floor(input.limit))
  const mine = input.runs.filter((r) => r.dungeonId === input.dungeonId && inWindow(r, input))
  const best = bestRuns(mine)

  if (input.dungeonId !== input.demoDungeonId) {
    const entries = rankEntries(best.map((r) => playerEntry(r, input, r.id))).slice(0, limit)
    const top = entries[0] ?? null
    return {
      entries,
      me: { rank: top ? 1 : null, is_provisional: false, entry: top },
      updated_at: input.updatedAt,
    }
  }

  const stored = !input.isGuest && best.length > 0 ? playerEntry(best[0], input, `player-${best[0].id}`) : null
  const ranked = rankEntries([...rivalEntries(input.period), ...(stored ? [stored] : [])])
  const me = stored ? (ranked.find((e) => e.id === stored.id) ?? null) : null
  return {
    entries: ranked.slice(0, limit),
    me: { rank: me ? me.rank : null, is_provisional: false, entry: me },
    updated_at: input.updatedAt,
  }
}

/** Rank the run would hold on the all-time Demo_Board (rivals only), for the finish summary. */
export function runRankOnDemoBoard(run: { score: number; accuracy: number; bestStreak: number }, name: string): number {
  const rivals = rankEntries(rivalEntries('all'))
  return (
    outrankCount(rivals, {
      display_name: name,
      level: 1,
      score: run.score,
      accuracy: run.accuracy,
      best_streak: run.bestStreak,
    }) + 1
  )
}
