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
    expect(api.capabilities).toMatchObject({ roomRevenants: false, floors: false, modes: true, dailyHaunt: true, leaderboard: false })
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
    // Modes do not depend on floors: the backend runs them for any dungeon.
    expect(api.capabilities?.modes).toBe(true)
  })

  it('startRun sends the floor and the mode of a request, and only the id for a plain id', async () => {
    const f = routedFetch({ 'POST /runs': wireRun })
    const api = createHttpClient('', f as unknown as typeof fetch)
    await api.startRun({ dungeon_id: 'dungeon-demo', floor_id: 'floor-1', mode: 'floor' })
    expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual({ dungeon_id: 'dungeon-demo', floor_id: 'floor-1', mode: 'floor' })
    await api.startRun({ dungeon_id: 'dungeon-demo', floor_id: null, mode: 'daily_haunt' })
    expect(JSON.parse(String(f.mock.calls[1][1]?.body))).toEqual({ dungeon_id: 'dungeon-demo', mode: 'daily_haunt' })
    await api.startRun('dungeon-demo')
    expect(JSON.parse(String(f.mock.calls[2][1]?.body))).toEqual({ dungeon_id: 'dungeon-demo' })
  })
  it('maps the rooms and the mode a backend run reports (a practice pick)', async () => {
    const picked = { ...wireRun, mode: 'weak_topics', room_ids: [wireRun.rooms[0].room_id] }
    const api = createHttpClient('', routedFetch({ 'POST /runs': picked }) as unknown as typeof fetch)
    const run = await api.startRun({ dungeon_id: 'dungeon-demo', floor_id: null, mode: 'weak_topics' })
    expect(run.mode).toBe('weak_topics')
    expect(run.room_ids).toEqual([wireRun.rooms[0].room_id])
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

describe('Http_Client progress and Daily Haunt summary', () => {
  it('passes xp_to_next to the HUD and reads the streak and next due time from GET /progress', async () => {
    const progress = { user_id: 'u1', level: 2, total_xp: 140, unlocked_weapons: ['Rusty Dagger'], xp_to_next: 60, daily_streak: 3, due_review_count: 2, next_due_at: '2026-11-25T08:00:00' }
    const f = routedFetch({ 'GET /progress': progress, 'GET /reviews/due': wireDueReviews })
    const api = createHttpClient('', f as unknown as typeof fetch)
    const p = await api.getProgress()
    expect(p.xp_to_next).toBe(60)
    expect(p.due_review_count).toBe(2)
    const summary = await api.getDueReviews()
    expect(summary).toMatchObject({ daily_streak: 3, next_due_at: '2026-11-25T08:00:00', due_count: wireDueReviews.length })
  })
})