import { ApiError } from '../errors'
import type { BoardEntry, BoardResponse } from '../../types/api'

/**
 * MOCK-ONLY leaderboard test switch (frontend-11, dev builds only). Used by the Layout_Check to see every board
 * state without a Backend. Real mode never reads it.
 *
 *  - `?mockBoard=<0..20>`: the board shows exactly that many entries (the seeded Ghost Rivals first; extra
 *    synthetic players are added past 8, one with a very long name to prove truncation).
 *  - `?mockBoard=error`: the board request fails (the error card with Retry).
 *  - `?mockBoard=slow`: the board request never finishes (the loading skeleton stays).
 */
export type MockBoardSwitch = { count: number } | 'error' | 'slow' | null

export function parseMockBoardSwitch(search: string, dev: boolean): MockBoardSwitch {
  if (!dev) return null
  const raw = new URLSearchParams(search).get('mockBoard')
  if (raw === 'error' || raw === 'slow') return raw
  if (raw !== null && /^\d{1,2}$/.test(raw)) return { count: Math.min(20, Number(raw)) }
  return null
}

export function readMockBoardSwitch(): MockBoardSwitch {
  if (typeof window === 'undefined') return null
  return parseMockBoardSwitch(window.location.search, import.meta.env.DEV)
}

/** Applies the switch to a built board. `error` and `slow` are handled by the caller before building. */
export function applyMockBoardCount(res: BoardResponse, count: number): BoardResponse {
  const entries: BoardEntry[] = res.entries.slice(0, count)
  for (let i = entries.length; i < count; i++) {
    const last = entries[i - 1]?.points ?? 3000
    entries.push({
      rank: i + 1,
      public_id: `p_synthetic_${i + 1}`,
      handle: `Player#${1000 + i}`,
      display_name: i === 11 ? 'A very long display name that must be cut with an ellipsis' : `Player ${i + 1}`,
      is_guest: false,
      level: 1 + (i % 9),
      points: Math.max(1, last - 20),
      rooms_cleared: i,
      badge_ids: [],
    })
  }
  return { ...res, entries: entries.map((e, i) => ({ ...e, rank: i + 1 })), total_ranked_players: entries.length }
}

export const mockBoardError = (): ApiError => new ApiError(500, 'The board is unavailable (mock switch).')
