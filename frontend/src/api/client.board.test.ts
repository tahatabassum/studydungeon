import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './client'
import { capabilityOf } from './ApiClient'
import { ApiError } from './errors'
import { ContractError } from './ContractError'
import { leaderboardViewOf } from '../state/useLeaderboardSupport'

function respond(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      void input
      void init
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
    },
  )
}

const boardBody = {
  board: 'preloaded',
  period: 'week',
  week: { timezone: 'UTC', starts_at: '2026-11-16T00:00:00Z', resets_at: '2026-11-23T00:00:00Z' },
  updated_at: '2026-11-20T12:00:00Z',
  next_refresh_at: '2026-11-20T13:00:00Z',
  total_ranked_players: 2,
  entries: [
    {
      rank: 1,
      public_id: 'p_a',
      handle: 'Raven#4821',
      display_name: 'Raven',
      tag: '4821',
      is_guest: true,
      level: 4,
      points: 2450,
      rooms_cleared: 12,
      badge_ids: ['boss_slayer'],
      username: 'guest_secret',
      id: 'uuid-1',
      is_seeded_rival: true,
    },
  ],
  me: null,
}

describe('Http_Client getBoard (frontend-10 task 7.2)', () => {
  it('GETs /leaderboard with board and period, drops unknown keys and settles the capability to on', async () => {
    const f = respond(boardBody)
    const api = createHttpClient('http://api', f as unknown as typeof fetch)
    expect(capabilityOf(api, 'liveBoard')).toBe('unproven')
    const out = await api.getBoard({ board: 'preloaded', period: 'week' })
    expect(f.mock.calls[0]![0]).toBe('http://api/leaderboard?board=preloaded&period=week')
    expect(out.entries[0]).not.toHaveProperty('username')
    expect(out.entries[0]).not.toHaveProperty('id')
    expect(out.entries[0]).not.toHaveProperty('is_seeded_rival')
    expect(out.me).toBeNull()
    expect(capabilityOf(api, 'liveBoard')).toBe('on')
  })

  it.each([404, 405, 501])('turns liveBoard off on %s', async (status) => {
    const api = createHttpClient('http://api', respond({ detail: 'no' }, status) as unknown as typeof fetch)
    await expect(api.getBoard({ board: 'overall', period: 'all' })).rejects.toBeInstanceOf(ApiError)
    expect(capabilityOf(api, 'liveBoard')).toBe('off')
  })

  it('keeps Retry-After on a 429 and leaves the capability unchanged', async () => {
    const api = createHttpClient('http://api', respond({ detail: 'slow' }, 429, { 'Retry-After': '30' }) as unknown as typeof fetch)
    await expect(api.getBoard({ board: 'overall', period: 'all' })).rejects.toMatchObject({ status: 429, retryAfter: '30' })
    expect(capabilityOf(api, 'liveBoard')).toBe('unproven')
  })

  it('throws a ContractError for a malformed body', async () => {
    const api = createHttpClient('http://api', respond({ ...boardBody, entries: [{ rank: 'x' }] }) as unknown as typeof fetch)
    await expect(api.getBoard({ board: 'overall', period: 'all' })).rejects.toBeInstanceOf(ContractError)
  })
})

describe('leaderboardViewOf', () => {
  it('is live unless liveBoard is off, then legacy unless leaderboard is false, else soon', () => {
    expect(leaderboardViewOf({})).toBe('live')
    expect(leaderboardViewOf({ capabilities: { liveBoard: 'unproven', leaderboard: false } as never })).toBe('live')
    expect(leaderboardViewOf({ capabilities: { liveBoard: false, leaderboard: true } as never })).toBe('legacy')
    expect(leaderboardViewOf({ capabilities: { liveBoard: false, leaderboard: false } as never })).toBe('soon')
  })
})
