import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './client'
import { ContractError, describeError } from './ContractError'
import { ApiError } from './errors'
import {
  wireAttemptCorrect,
  wireAttemptWrong,
  wireClear,
  wireDemoSession,
  wireDueReviews,
  wireDungeon,
  wireErrors,
  wireFinish,
  wireProgress,
  wireRun,
  wireRunResumed,
} from './wire/wire.fixtures'
import type { AttemptRequest } from '../types/api'

type FetchArgs = [url: string | URL | Request, init?: RequestInit]

function fakeFetch(response: (() => Response) | Error) {
  return vi.fn(async (...args: FetchArgs) => {
    void args
    if (response instanceof Error) throw response
    return response()
  })
}

/** Routes by "METHOD /path" to a JSON body (or a [body, status] pair). */
function routedFetch(routes: Record<string, unknown | [unknown, number]>) {
  return vi.fn(async (...args: FetchArgs) => {
    const [url, init] = args
    const path = new URL(String(url), 'http://x').pathname
    const hit = routes[`${init?.method ?? 'GET'} ${path}`]
    if (hit === undefined) return new Response(JSON.stringify({ detail: 'no route' }), { status: 404 })
    const [body, status] = Array.isArray(hit) && hit.length === 2 && typeof hit[1] === 'number' ? hit : [hit, 200]
    return new Response(JSON.stringify(body), { status: status as number, headers: { 'Content-Type': 'application/json' } })
  })
}

const json = (body: unknown, status = 200) => () =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('createHttpClient', () => {
  it('uses credentials include and the right URL/method for each call', async () => {
    const bodies = [wireDemoSession, wireDungeon, wireRun, wireAttemptCorrect, wireClear]
    let i = 0
    const f = fakeFetch(() => json(bodies[i++])())
    const api = createHttpClient('http://api.test/', f as unknown as typeof fetch)

    await api.startDemoSession()
    await api.getDungeon('d 1')
    await api.startRun('d1')
    await api.submitAttempt('run-1', { question_id: 'qa1', selected_answer: 'a', attempt_id: 'x' })
    await api.clearRoom('run-1', 'room-1')

    const calls = f.mock.calls.map(([url, init]) => [String(url), init?.method])
    expect(calls).toEqual([
      ['http://api.test/demo/session', 'POST'],
      ['http://api.test/dungeons/d%201', 'GET'],
      ['http://api.test/runs', 'POST'],
      ['http://api.test/runs/run-1/attempts', 'POST'],
      ['http://api.test/runs/run-1/rooms/room-1/clear', 'POST'],
    ])
    for (const [, init] of f.mock.calls) expect(init?.credentials).toBe('include')
  })

  it('returns domain values: dungeon name, rooms, flattened questions and a run in the first room', async () => {
    const f = routedFetch({ 'GET /dungeons/dungeon-demo': wireDungeon, 'POST /runs': wireRun })
    const api = createHttpClient('http://api.test', f as unknown as typeof fetch)
    const d = await api.getDungeon('dungeon-demo')
    expect(d.name).toBe(wireDungeon.title)
    expect(d.rooms.map((r) => [r.order, r.monster.max_hp, r.monster.kind])).toEqual([
      [1, 80, 'gear_golem'],
      [2, 90, 'paper_wraith'],
      [3, 220, 'exam_warden'],
    ])
    expect(d.questions).toHaveLength(6)
    const run = await api.startRun(d.id)
    expect(run).toMatchObject({ id: 'run-1', player_hp: 100, monster_hp: 80, current_room_id: 'room-a' })
  })

  it('sends the starting dungeon id in the run body', async () => {
    const f = routedFetch({ 'POST /runs': wireRun })
    const api = createHttpClient('', f as unknown as typeof fetch)
    await api.startRun('dungeon-demo')
    expect(JSON.parse(String(f.mock.calls[0][1]?.body))).toEqual({ dungeon_id: 'dungeon-demo' })
  })

  it('getRun rehydrates from GET /runs/{id}: first uncleared room, its HP, score and streak', async () => {
    const f = routedFetch({ 'GET /runs/run-1': wireRunResumed })
    const api = createHttpClient('', f as unknown as typeof fetch)
    const run = await api.getRun('run-1')
    expect(run).toEqual({
      id: 'run-1',
      dungeon_id: 'dungeon-demo',
      player_hp: 80,
      monster_hp: 50,
      current_room_id: 'room-b',
      score: 240,
      streak: 2,
    })
  })

  it('getProgress is GET /progress and maps names to ids with no xp_to_next', async () => {
    const f = fakeFetch(json(wireProgress))
    const api = createHttpClient('http://api.test/', f as unknown as typeof fetch)
    const p = await api.getProgress()
    expect(p.level).toBe(2)
    expect(p.total_xp).toBe(120)
    expect(p.xp_to_next).toBeUndefined()
    expect(p.unlocked_weapons).toEqual(['rusty_dagger', 'arcane_staff'])
    expect(String(f.mock.calls[0][0])).toBe('http://api.test/progress')
    expect(f.mock.calls[0][1]?.method).toBe('GET')
    expect(f.mock.calls[0][1]?.credentials).toBe('include')
    expect(f.mock.calls[0][1]?.body).toBeUndefined()
  })

  it('maps getProgress errors to ApiError with the backend code', async () => {
    const f = fakeFetch(json({ detail: { code: 'HTTP_401', message: 'no session' } }, 401))
    const api = createHttpClient('', f as unknown as typeof fetch)
    const err = await api.getProgress().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(401)
    expect((err as ApiError).code).toBe('HTTP_401')
    expect((err as ApiError).message).toBe('no session')
    expect(describeError(err, 'fallback')).toContain('session expired')
  })

  it('sends finishRun without a body and returns the mapped summary', async () => {
    const f = fakeFetch(json(wireFinish))
    const api = createHttpClient('', f as unknown as typeof fetch)
    const summary = await api.finishRun('run-1')
    expect(summary).toEqual({ score: 600, xp: 160, correct: 6, total: 7, accuracy: 0.86, mastery_band: 'Strong' })
    expect(f.mock.calls[0][1]?.body).toBeUndefined()
  })

  it('sends only attempt_id, question_id, selected_answer and weapon_name (Rusty Dagger by default)', async () => {
    const f = routedFetch({ 'POST /runs': wireRun, 'POST /runs/run-1/attempts': wireAttemptWrong, 'GET /dungeons/dungeon-demo': wireDungeon })
    const api = createHttpClient('', f as unknown as typeof fetch)
    await api.getDungeon('dungeon-demo')
    await api.startRun('dungeon-demo')
    const req = {
      question_id: 'qa1',
      selected_answer: 'CPU',
      attempt_id: 'a1',
      damage_dealt: 999,
      correct: true,
    } as unknown as AttemptRequest
    await api.submitAttempt('run-1', req)
    const call = f.mock.calls.find(([, init]) => String(init?.body).includes('attempt_id'))
    const body = JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['attempt_id', 'question_id', 'selected_answer', 'weapon_name'])
    expect(body.weapon_name).toBe('Rusty Dagger')
  })

  it('computes monster HP from damage dealt (the wire value is always 0), once per attempt_id', async () => {
    const f = routedFetch({
      'GET /dungeons/dungeon-demo': wireDungeon,
      'POST /runs': wireRun,
      'POST /runs/run-1/attempts': wireAttemptCorrect,
    })
    const api = createHttpClient('', f as unknown as typeof fetch)
    await api.getDungeon('dungeon-demo')
    await api.startRun('dungeon-demo')
    const req = { question_id: 'qa1', selected_answer: 'ALU', attempt_id: 'a1' }
    const first = await api.submitAttempt('run-1', req)
    expect(first).toMatchObject({ correct: true, damage_dealt: 20, monster_hp_remaining: 60, player_hp_remaining: 100, score_delta: 120, streak: 1 })
    expect(first.xp_delta).toBeUndefined()
    expect(first.source).toBeUndefined()
    expect(first.evidence_quote).toContain('Arithmetic Logic Unit')
    const again = await api.submitAttempt('run-1', req)
    expect(again).toEqual(first)
    const second = await api.submitAttempt('run-1', { ...req, attempt_id: 'a2' })
    expect(second.monster_hp_remaining).toBe(40)
    expect(f.mock.calls.filter(([, init]) => String(init?.body).includes('attempt_id'))).toHaveLength(2)
  })

  it('uses the best weapon the backend lists as unlocked, and falls back when it is rejected', async () => {
    let attempts = 0
    const f = vi.fn(async (...args: FetchArgs) => {
      const [url, init] = args
      const path = new URL(String(url), 'http://x').pathname
      const respond = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
      if (path === '/progress') return respond(wireProgress)
      if (path === '/dungeons/dungeon-demo') return respond(wireDungeon)
      if (path === '/runs') return respond(wireRun)
      attempts += 1
      const sent = JSON.parse(String(init?.body)) as { weapon_name: string }
      if (attempts === 1) {
        expect(sent.weapon_name).toBe('Arcane Staff')
        return respond({ detail: { code: 'WEAPON_LOCKED', message: 'locked' } }, 403)
      }
      expect(sent.weapon_name).toBe('Rusty Dagger')
      return respond(wireAttemptCorrect)
    })
    const api = createHttpClient('', f as unknown as typeof fetch)
    await api.getDungeon('dungeon-demo')
    await api.startRun('dungeon-demo')
    await api.getProgress()
    const r = await api.submitAttempt('run-1', { question_id: 'qa1', selected_answer: 'ALU', attempt_id: 'w1' })
    expect(r.weapon_id).toBe('rusty_dagger')
    expect(attempts).toBe(2)
  })

  it('getDueReviews keeps every item, resolving room_id from the loaded dungeon', async () => {
    const f = routedFetch({ 'GET /dungeons/dungeon-demo': wireDungeon, 'GET /reviews/due': wireDueReviews })
    const api = createHttpClient('', f as unknown as typeof fetch)
    await api.getDungeon('dungeon-demo')
    const due = await api.getDueReviews('dungeon-demo')
    expect(due.map((d) => [d.id, d.room_id])).toEqual([
      ['qa1', 'room-a'],
      ['other-dungeon-q', ''],
    ])
    expect(String(f.mock.calls[1][0])).toBe('/reviews/due')
  })

  it('declares real-mode capabilities: no room Revenants, floors, modes or Daily Haunt', () => {
    const api = createHttpClient('', fakeFetch(json({})) as unknown as typeof fetch)
    expect(api.capabilities).toEqual({ roomRevenants: false, floors: false, modes: false, dailyHaunt: false, leaderboard: false })
  })

  it('parses {detail:{code,message}} into ApiError.code and a friendly message', async () => {
    const f = fakeFetch(json(wireErrors.code, 409))
    const api = createHttpClient('', f as unknown as typeof fetch)
    const err = await api.finishRun('r').catch((e: unknown) => e)
    expect((err as ApiError).code).toBe('BOSS_NOT_CLEARED')
    expect((err as ApiError).status).toBe(409)
    expect(describeError(err, 'fallback')).toContain('boss')
  })

  it('handles the 422 array form and the validation body', async () => {
    const api = createHttpClient('', fakeFetch(json(wireErrors.fastapi422, 422)) as unknown as typeof fetch)
    const err = await api.startRun('d').catch((e: unknown) => e)
    expect((err as ApiError).code).toBe('VALIDATION_ERROR')
    expect((err as ApiError).message).toBe('Field required')
    const api2 = createHttpClient('', fakeFetch(json(wireErrors.validation, 422)) as unknown as typeof fetch)
    const err2 = await api2.startRun('d').catch((e: unknown) => e)
    expect((err2 as ApiError).code).toBe('VALIDATION_ERROR')
  })

  it('maps GUEST_FORBIDDEN to a friendly message', async () => {
    const body = { detail: { code: 'GUEST_FORBIDDEN', message: 'Guests are only permitted to play the public demo dungeon.' } }
    const api = createHttpClient('', fakeFetch(json(body, 403)) as unknown as typeof fetch)
    const err = await api.startRun('d').catch((e: unknown) => e)
    expect(describeError(err, 'fallback')).toContain('public demo')
  })

  it('throws ApiError with the HTTP status on non-2xx (string detail)', async () => {
    const f = fakeFetch(json({ detail: 'nope' }, 429))
    const api = createHttpClient('', f as unknown as typeof fetch)
    const err = await api.startRun('d').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(429)
    expect((err as ApiError).message).toBe('nope')
  })

  it('throws ContractError naming the endpoint and field when a response does not match', async () => {
    const f = fakeFetch(json({ ...wireProgress, total_xp: '120' }))
    const api = createHttpClient('', f as unknown as typeof fetch)
    const err = await api.getProgress().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ContractError)
    expect((err as ContractError).message).toContain('GET /progress')
    expect((err as ContractError).message).toContain('total_xp')
    expect(describeError(err, 'fallback')).toContain('total_xp')
    expect(describeError(new Error('x'), 'fallback')).toBe('fallback')
  })

  it('reports nested paths such as rooms[0].monster_hp', async () => {
    const bad = structuredClone(wireDungeon) as { rooms: Array<Record<string, unknown>> }
    delete bad.rooms[0].monster_hp
    const f = fakeFetch(json(bad))
    const api = createHttpClient('', f as unknown as typeof fetch)
    const err = await api.getDungeon('dungeon-demo').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ContractError)
    expect((err as ContractError).path).toBe('rooms[0].monster_hp')
    expect((err as ContractError).endpoint).toBe('GET /dungeons/{id}')
  })

  it('maps network failure to ApiError status 0', async () => {
    const f = fakeFetch(new TypeError('failed'))
    const api = createHttpClient('', f as unknown as typeof fetch)
    const err = await api.startDemoSession().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(0)
  })
})
