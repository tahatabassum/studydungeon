import { describe, expect, it, vi } from 'vitest'
import { createHttpClient, HTTP_CAPABILITIES } from './client'
import { ApiError } from './errors'
import { mapDungeon, wireDungeonSchema } from './wire'
import { wireDueReviews, wireDungeon, wireRun } from './wire/wire.fixtures'

type FetchArgs = [url: string | URL | Request, init?: RequestInit]

function routedFetch(routes: Record<string, unknown>) {
  return vi.fn(async (...args: FetchArgs) => {
    const [url, init] = args
    const path = new URL(String(url), 'http://x').pathname
    const hit = routes[`${init?.method ?? 'GET'} ${path}`]
    if (hit === undefined) return new Response(JSON.stringify({ detail: 'no route' }), { status: 404 })
    return new Response(JSON.stringify(hit), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
}

describe('Http_Client with floors (frontend-08)', () => {
  it('maps a legacy dungeon to one floor "The Crypt" and keeps capabilities off', async () => {
    const f = routedFetch({ 'GET /dungeons/dungeon-demo': wireDungeon })
    const api = createHttpClient('', f as unknown as typeof fetch)
    const d = await api.getDungeon('dungeon-demo')
    expect(d.floors).toHaveLength(1)
    expect(d.floors![0]).toMatchObject({ title: 'The Crypt', status: 'ready', rank: null })
    expect(d.floors![0].room_ids).toEqual(d.rooms.map((r) => r.id))
    expect(api.capabilities).toEqual({ roomRevenants: false, floors: false, modes: false, dailyHaunt: false, leaderboard: false })
    expect(HTTP_CAPABILITIES).toEqual(api.capabilities)
  })

  it('turns the floors capability on only when the backend sends floors', async () => {
    const legacy = mapDungeon(wireDungeonSchema.parse(wireDungeon))
    const withFloors = {
      ...wireDungeon,
      floors: [{ ...legacy.floors![0], id: 'floor-a', title: 'Backend floor' }],
    }
    const f = routedFetch({ 'GET /dungeons/dungeon-demo': withFloors })
    const api = createHttpClient('', f as unknown as typeof fetch)
    expect(api.capabilities?.floors).toBe(false)
    const d = await api.getDungeon('dungeon-demo')
    expect(d.floors![0].title).toBe('Backend floor')
    expect(api.capabilities?.floors).toBe(true)
    expect(api.capabilities?.modes).toBe(false)
  })

  it('startRun with a request sends only the dungeon id (D18)', async () => {
    const f = routedFetch({ 'POST /runs': wireRun })
    const api = createHttpClient('', f as unknown as typeof fetch)
    await api.startRun({ dungeon_id: 'dungeon-demo', floor_id: 'floor-1', mode: 'floor' })
    expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual({ dungeon_id: 'dungeon-demo' })
  })

  it('getDueReviews() returns the new shape; with a dungeon id the old array', async () => {
    const f = routedFetch({ 'GET /reviews/due': wireDueReviews })
    const api = createHttpClient('', f as unknown as typeof fetch)
    const summary = await api.getDueReviews()
    expect(summary).toMatchObject({ due_count: wireDueReviews.length, next_due_at: null, daily_streak: 0 })
    expect(summary.items).toHaveLength(wireDueReviews.length)
    const legacy = await api.getDueReviews('dungeon-demo')
    expect(Array.isArray(legacy)).toBe(true)
  })

  it('reports the floors of the dungeon as generation status and rejects retryFloor', async () => {
    const f = routedFetch({ 'GET /dungeons/dungeon-demo': wireDungeon })
    const api = createHttpClient('', f as unknown as typeof fetch)
    const status = await api.getGenerationStatus('dungeon-demo')
    expect(status.floors).toEqual([{ id: 'floor-legacy', status: 'ready' }])
    await expect(api.retryFloor('floor-legacy')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('wire additions (frontend-08)', () => {
  it('maps the optional attempt and finish additions and ignores their absence', async () => {
    const { mapAttempt, mapFinish, wireAttemptSchema, wireFinishSchema } = await import('./wire')
    const { wireAttemptWrong, wireFinish } = await import('./wire/wire.fixtures')
    const ctx = { monsterHpRemaining: 40, scoreDelta: 0, weaponId: 'rusty_dagger' }
    const plain = mapAttempt(wireAttemptSchema.parse(wireAttemptWrong), ctx)
    expect(plain.requeue_after).toBeUndefined()
    expect(plain.is_retry).toBeUndefined()
    const rich = mapAttempt(
      wireAttemptSchema.parse({ ...wireAttemptWrong, requeue_after: 3, is_retry: false, correct_answer: 'CPU' }),
      ctx,
    )
    expect(rich).toMatchObject({ requeue_after: 3, is_retry: false, correct_answer: 'CPU' })
    const fin = mapFinish(
      wireFinishSchema.parse({
        ...wireFinish,
        floor_rank: 'A',
        mastery_by_topic: [{ topic_id: 't1', title: 'T', mastery: 60 }],
        chest_rewards: [{ id: 'c', kind: 'xp', label: 'XP', amount: 5 }],
      }),
    )
    expect(fin.floor_rank).toBe('A')
    expect(fin.chest_rewards).toHaveLength(1)
    expect(mapFinish(wireFinishSchema.parse(wireFinish)).floor_rank).toBeUndefined()
  })
})
