import type { BoardEntry, BoardKind, BoardMe, BoardResponse, LeaderboardPeriod, PlayerPoints } from '../../types/api'
import { RIVAL_SEEDS } from './mockLeaderboard'
import { weekStartMs } from './mockPoints'

/**
 * MOCK-ONLY live board (frontend-10 D16, PROPOSED). Builds a `BoardResponse` in the shape of V2 D.3 from the
 * mock points and the session, plus the seeded Ghost Rivals (marked `is_seeded_rival`; the mock domain only).
 * The ranking rule lives here and nowhere else: points desc, then who reached the total first, then public id.
 */
const HOUR_MS = 60 * 60 * 1000
const WEEK_MS = 7 * 24 * HOUR_MS
const TOP = 20

export interface BoardPlayer {
  publicId: string
  handle: string
  displayName?: string
  tag?: string
  isGuest: boolean
  level: number
  roomsCleared: number
  /** Points for all time and for the current week, by board. */
  all: PlayerPoints
  week: PlayerPoints
  /** When the player reached the current total (tie-break). */
  reachedAtMs: number
}

export interface MockBoardInput {
  board: BoardKind
  period: LeaderboardPeriod
  nowMs: number
  /** null without a session. */
  player: BoardPlayer | null
}

interface Row {
  entry: Omit<BoardEntry, 'rank'>
  reachedAtMs: number
}

function split(score: number): { preloaded: number; own_notes: number } {
  const preloaded = Math.round(score * 0.7)
  return { preloaded, own_notes: score - preloaded }
}

function rivalRows(input: MockBoardInput): Row[] {
  return RIVAL_SEEDS.map((r, i) => {
    const s = split(input.period === 'week' ? r.week.score : r.all.score)
    const points = input.board === 'overall' ? s.preloaded + s.own_notes : s[input.board]
    const [name, ...rest] = r.name.split(' ')
    void rest
    return {
      reachedAtMs: Date.UTC(2026, 0, 1) + i * 60_000,
      entry: {
        public_id: `p_${r.id.replace('-', '')}`,
        handle: `${name}#${String(1000 + i * 111).slice(-4)}`,
        display_name: r.name,
        is_guest: false,
        level: r.level,
        points,
        rooms_cleared: r.level * 3,
        badge_ids: [...r.badges],
        is_seeded_rival: true,
      },
    }
  })
}

function playerPoints(p: BoardPlayer, input: MockBoardInput): number {
  const t = input.period === 'week' ? p.week : p.all
  return t[input.board]
}

/** Ranks rows by points desc, then reached_at asc, then public_id asc, and assigns unique ranks. */
export function rankRows(rows: Row[]): BoardEntry[] {
  return rows
    .filter((r) => r.entry.points > 0)
    .sort(
      (a, b) =>
        b.entry.points - a.entry.points ||
        a.reachedAtMs - b.reachedAtMs ||
        (a.entry.public_id < b.entry.public_id ? -1 : a.entry.public_id > b.entry.public_id ? 1 : 0),
    )
    .map((r, i) => ({ rank: i + 1, ...r.entry }))
}

export function buildMockBoard(input: MockBoardInput): BoardResponse {
  const rows = rivalRows(input)
  const mine = input.player ? playerPoints(input.player, input) : 0
  if (input.player && mine > 0) {
    const p = input.player
    const entry: Omit<BoardEntry, 'rank'> = {
      public_id: p.publicId,
      handle: p.handle,
      is_guest: p.isGuest,
      level: p.level,
      points: mine,
      rooms_cleared: p.roomsCleared,
      badge_ids: [],
    }
    if (p.displayName !== undefined) entry.display_name = p.displayName
    if (p.tag !== undefined) entry.tag = p.tag
    rows.push({ entry, reachedAtMs: p.reachedAtMs })
  }
  const ranked = rankRows(rows)
  const cutoff = ranked.length >= TOP ? ranked[TOP - 1].points : 0

  let me: BoardMe | null = null
  if (input.player) {
    const idx = ranked.findIndex((e) => e.public_id === input.player!.publicId)
    const rank = idx >= 0 ? idx + 1 : null
    const above = idx > 0 ? ranked[idx - 1] : null
    const inTop = rank !== null && rank <= TOP
    me = {
      live: true,
      public_id: input.player.publicId,
      handle: input.player.handle,
      rank,
      points: mine,
      next_above: above
        ? { rank: above.rank, handle: above.handle, points: above.points, points_needed: above.points - mine + 1 }
        : null,
      top20: { in_top20: inTop, cutoff_points: cutoff, points_needed: inTop ? 0 : Math.max(0, cutoff - mine + 1) },
    }
    if (rank === null) me.reason = 'no_points_yet'
  }

  const updated = Math.floor(input.nowMs / HOUR_MS) * HOUR_MS
  const start = weekStartMs(input.nowMs)
  return {
    board: input.board,
    period: input.period,
    week: {
      timezone: 'UTC',
      starts_at: new Date(start).toISOString(),
      resets_at: new Date(start + WEEK_MS).toISOString(),
    },
    updated_at: new Date(updated).toISOString(),
    next_refresh_at: new Date(updated + HOUR_MS).toISOString(),
    total_ranked_players: ranked.length,
    entries: ranked.slice(0, TOP),
    me,
  }
}
