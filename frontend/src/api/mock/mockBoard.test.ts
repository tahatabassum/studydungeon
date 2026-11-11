import { describe, expect, it } from 'vitest'
import { buildMockBoard, type BoardPlayer } from './mockBoard'
import { createMockAdapter } from './mockAdapter'
import { boardResponseSchema } from '../schemas'

const NOW = Date.UTC(2026, 10, 18, 12, 34, 56) // Wednesday
const zero = { preloaded: 0, own_notes: 0, overall: 0 }
const player = (over: Partial<BoardPlayer> = {}): BoardPlayer => ({
  publicId: 'p_me',
  handle: 'Bat#2231',
  isGuest: true,
  level: 2,
  roomsCleared: 3,
  all: zero,
  week: zero,
  reachedAtMs: NOW,
  ...over,
})

describe('buildMockBoard', () => {
  it('lists rivals with unique ranks in points order, marks them and matches the domain schema', () => {
    const res = buildMockBoard({ board: 'overall', period: 'all', nowMs: NOW, player: null })
    expect(boardResponseSchema.safeParse(res).success).toBe(true)
    expect(res.me).toBeNull()
    expect(res.entries.map((e) => e.rank)).toEqual(res.entries.map((_, i) => i + 1))
    for (let i = 1; i < res.entries.length; i++) expect(res.entries[i - 1].points).toBeGreaterThanOrEqual(res.entries[i].points)
    expect(res.entries.every((e) => e.is_seeded_rival === true)).toBe(true)
  })

  it('uses a one hour refresh window and the Monday 00:00 UTC week', () => {
    const res = buildMockBoard({ board: 'overall', period: 'week', nowMs: NOW, player: null })
    expect(Date.parse(res.next_refresh_at) - Date.parse(res.updated_at)).toBe(3_600_000)
    expect(res.week).toEqual({ timezone: 'UTC', starts_at: '2026-11-16T00:00:00.000Z', resets_at: '2026-11-23T00:00:00.000Z' })
  })

  it('gives a player with no points rank null, reason no_points_yet and the points to enter', () => {
    const res = buildMockBoard({ board: 'overall', period: 'all', nowMs: NOW, player: player() })
    expect(res.me).toMatchObject({ live: true, rank: null, points: 0, next_above: null, reason: 'no_points_yet' })
    expect(res.me!.top20).toMatchObject({ in_top20: false, cutoff_points: 0, points_needed: 1 })
    expect(res.entries.some((e) => e.public_id === 'p_me')).toBe(false)
  })

  it('ranks a player with points and computes next_above and the top 20 numbers', () => {
    const res = buildMockBoard({ board: 'overall', period: 'all', nowMs: NOW, player: player({ all: { preloaded: 3000, own_notes: 0, overall: 3000 } }) })
    const me = res.me!
    const i = res.entries.findIndex((e) => e.public_id === 'p_me')
    expect(me.rank).toBe(i + 1)
    expect(res.entries[i].is_seeded_rival).toBeUndefined()
    expect(me.next_above!.points_needed).toBe(me.next_above!.points - 3000 + 1)
    expect(me.top20).toMatchObject({ in_top20: true, points_needed: 0 })
  })

  it('breaks ties by reached_at then public_id', () => {
    const rival = buildMockBoard({ board: 'overall', period: 'all', nowMs: NOW, player: null }).entries[0]
    const res = buildMockBoard({ board: 'overall', period: 'all', nowMs: NOW, player: player({ all: { preloaded: rival.points, own_notes: 0, overall: rival.points } }) })
    expect(res.entries[0].public_id).toBe(rival.public_id)
    expect(res.me!.rank).toBe(2)
    expect(res.me!.next_above!.points_needed).toBe(1)
  })
})

describe('mock adapter getBoard', () => {
  it('returns me null without a session and a live me block after a guest is created', async () => {
    const api = createMockAdapter({ now: () => NOW })
    expect((await api.getBoard({ board: 'overall', period: 'all' })).me).toBeNull()
    await api.createGuest({ display_name: 'Raven', accept_public_notice: true })
    const res = await api.getBoard({ board: 'overall', period: 'all' })
    expect(res.me).toMatchObject({ live: true, rank: null, reason: 'no_points_yet' })
  })
})
