import { describe, expect, it } from 'vitest'
import { ENDPOINT_SCHEMAS } from '../schemas'
import { mapBoard, wireBoardSchema } from './board'

/** The shape the real backend sends for a player who has points (Pydantic writes None as null). */
const realBody = {
  board: 'overall',
  period: 'all',
  week: null,
  updated_at: '2026-11-24T13:36:51.689626Z',
  next_refresh_at: '2026-11-24T13:37:51.689626Z',
  total_ranked_players: 1,
  entries: [
    { rank: 1, public_id: 'p_5b5aaa0c', handle: 'p_5b5aaa0c', display_name: null, tag: null, is_guest: false, level: 3, points: 2560, rooms_cleared: 4, badge_ids: [] },
  ],
  me: {
    live: true,
    public_id: 'p_5b5aaa0c',
    handle: 'p_5b5aaa0c',
    rank: 1,
    points: 2560,
    next_above: null,
    top20: { in_top20: true, cutoff_points: 0, points_needed: 0 },
    reason: null,
  },
}

describe('GET /leaderboard with nulls from the real backend', () => {
  it('accepts null optional fields and maps them to absent', () => {
    const board = mapBoard(wireBoardSchema.parse(realBody))
    expect(board.entries[0]).not.toHaveProperty('display_name')
    expect(board.entries[0]).not.toHaveProperty('tag')
    expect(board.me).not.toHaveProperty('reason')
    expect(board.me?.rank).toBe(1)
    expect(ENDPOINT_SCHEMAS.getBoard.schema.safeParse(board).success).toBe(true)
  })

  it('keeps a reason that is sent', () => {
    const body = { ...realBody, me: { ...realBody.me, rank: null, points: 0, reason: 'no_points_yet' } }
    expect(mapBoard(wireBoardSchema.parse(body)).me?.reason).toBe('no_points_yet')
  })
})