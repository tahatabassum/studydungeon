import { z } from 'zod'
import type { BoardEntry, BoardMe, BoardResponse } from '../../types/api'

/**
 * frontend-10 (PROPOSED, V2 D.3): `GET /leaderboard?board=&period=`. zod objects strip unknown keys, so a
 * `username`, an internal `id` or a rival flag from the wire never reaches the domain.
 */
const boardKind = z.enum(['preloaded', 'own_notes', 'overall'])
const period = z.enum(['all', 'week'])

export const wireBoardEntrySchema = z.object({
  rank: z.number().int().min(1),
  public_id: z.string().min(1),
  handle: z.string(),
  display_name: z.string().optional(),
  tag: z.string().optional(),
  is_guest: z.boolean(),
  level: z.number().int().nonnegative(),
  points: z.number().int().nonnegative(),
  rooms_cleared: z.number().int().nonnegative(),
  badge_ids: z.array(z.string()).optional(),
})

export const wireBoardMeSchema = z.object({
  live: z.boolean(),
  public_id: z.string().optional(),
  handle: z.string().optional(),
  rank: z.number().int().min(1).nullable(),
  points: z.number().int().nonnegative(),
  next_above: z
    .object({
      rank: z.number().int().min(1),
      handle: z.string(),
      points: z.number().int().nonnegative(),
      points_needed: z.number().int().nonnegative(),
    })
    .nullable(),
  top20: z.object({
    in_top20: z.boolean(),
    cutoff_points: z.number().int().nonnegative(),
    points_needed: z.number().int().nonnegative(),
  }),
  reason: z.string().optional(),
})

export const wireBoardSchema = z.object({
  board: boardKind,
  period,
  week: z.object({ timezone: z.string(), starts_at: z.string(), resets_at: z.string() }).nullish(),
  updated_at: z.string(),
  next_refresh_at: z.string(),
  total_ranked_players: z.number().int().nonnegative().optional(),
  entries: z.array(wireBoardEntrySchema),
  me: wireBoardMeSchema.nullable(),
})

function mapEntry(e: z.output<typeof wireBoardEntrySchema>): BoardEntry {
  const out: BoardEntry = {
    rank: e.rank,
    public_id: e.public_id,
    handle: e.handle,
    is_guest: e.is_guest,
    level: e.level,
    points: e.points,
    rooms_cleared: e.rooms_cleared,
  }
  if (e.display_name !== undefined) out.display_name = e.display_name
  if (e.tag !== undefined) out.tag = e.tag
  if (e.badge_ids !== undefined) out.badge_ids = [...e.badge_ids]
  return out
}

function mapMe(m: z.output<typeof wireBoardMeSchema>): BoardMe {
  const out: BoardMe = {
    live: m.live,
    rank: m.rank,
    points: m.points,
    next_above: m.next_above ? { ...m.next_above } : null,
    top20: { ...m.top20 },
  }
  if (m.public_id !== undefined) out.public_id = m.public_id
  if (m.handle !== undefined) out.handle = m.handle
  if (m.reason !== undefined) out.reason = m.reason
  return out
}

export function mapBoard(w: z.output<typeof wireBoardSchema>): BoardResponse {
  const out: BoardResponse = {
    board: w.board,
    period: w.period,
    updated_at: w.updated_at,
    next_refresh_at: w.next_refresh_at,
    entries: w.entries.map(mapEntry),
    me: w.me ? mapMe(w.me) : null,
  }
  if (w.week) out.week = { timezone: w.week.timezone, starts_at: w.week.starts_at, resets_at: w.week.resets_at }
  if (w.total_ranked_players !== undefined) out.total_ranked_players = w.total_ranked_players
  return out
}
