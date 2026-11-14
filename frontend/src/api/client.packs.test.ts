import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './client'
import { capabilityOf } from './ApiClient'
import { ApiError, friendlyMessage } from './errors'
import { wireFinish, wireClear } from './wire/wire.fixtures'
import { mapClear, mapFinish, wireClearSchema, wireFinishSchema } from './wire'

type FetchArgs = [url: string | URL | Request, init?: RequestInit]

function respond(body: unknown, status = 200) {
  return vi.fn(async (...args: FetchArgs) => {
    void args
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  })
}

const packsBody = {
  packs: [
    {
      id: 'pack-1',
      order: 1,
      title: 'Pack 1',
      description: 'd',
      dungeon_id: 'dun-1',
      floors_total: 2,
      floors_cleared: 0,
      final_boss_cleared: false,
      status: 'available',
      points_earned: 0,
      internal_note: 'dropped',
    },
  ],
  next_pack_id: 'pack-1',
  all_completed: false,
}

describe('Http_Client getPacks (frontend-10 task 5.2)', () => {
  it('GETs /packs, maps the response and settles the unproven capability to on', async () => {
    const f = respond(packsBody)
    const api = createHttpClient('http://api', f as unknown as typeof fetch)
    expect(capabilityOf(api, 'packs')).toBe('unproven')
    const out = await api.getPacks()
    expect(f.mock.calls[0]![0]).toBe('http://api/packs')
    expect(out.next_pack_id).toBe('pack-1')
    expect(out.packs[0]).not.toHaveProperty('internal_note')
    expect(capabilityOf(api, 'packs')).toBe('on')
  })

  it.each([404, 405, 501])('turns the capability off on %s', async (status) => {
    const api = createHttpClient('http://api', respond({ detail: 'nope' }, status) as unknown as typeof fetch)
    await expect(api.getPacks()).rejects.toBeInstanceOf(ApiError)
    expect(capabilityOf(api, 'packs')).toBe('off')
  })

  it('leaves the capability unchanged on a 500', async () => {
    const api = createHttpClient('http://api', respond({ detail: 'boom' }, 500) as unknown as typeof fetch)
    await expect(api.getPacks()).rejects.toMatchObject({ status: 500 })
    expect(capabilityOf(api, 'packs')).toBe('unproven')
  })

  it('maps 403 PACK_LOCKED to its code and a friendly message', async () => {
    const f = respond({ detail: { code: 'PACK_LOCKED', message: 'locked' } }, 403)
    const api = createHttpClient('http://api', f as unknown as typeof fetch)
    await expect(api.startRun('dun-2')).rejects.toMatchObject({ status: 403, code: 'PACK_LOCKED' })
    expect(friendlyMessage('PACK_LOCKED', 403)).toMatch(/locked/i)
  })
})

describe('points fields on the wire (frontend-10 task 5.1)', () => {
  it('maps the optional points, player points and pack progress on finish', () => {
    const wire = wireFinishSchema.parse({
      ...wireFinish,
      points_earned: 840,
      player_points: { preloaded: 840, own_notes: 0, overall: 840 },
      pack_progress: { pack_id: 'pack-1', status: 'completed', unlocked_pack_id: 'pack-2', all_completed: false },
    })
    expect(mapFinish(wire)).toMatchObject({
      points_earned: 840,
      player_points: { preloaded: 840, own_notes: 0, overall: 840 },
      pack_progress: { pack_id: 'pack-1', unlocked_pack_id: 'pack-2' },
    })
  })

  it('leaves the fields out when the Backend sends none (today)', () => {
    const summary = mapFinish(wireFinishSchema.parse(wireFinish))
    expect(summary).not.toHaveProperty('points_earned')
    expect(summary).not.toHaveProperty('pack_progress')
    expect(mapClear(wireClearSchema.parse(wireClear))).not.toHaveProperty('points_awarded')
  })

  it('maps points on clear', () => {
    const out = mapClear(wireClearSchema.parse({ ...wireClear, points_awarded: 50, points_reason: 'room_clear' }))
    expect(out).toMatchObject({ points_awarded: 50, points_reason: 'room_clear' })
  })
})
