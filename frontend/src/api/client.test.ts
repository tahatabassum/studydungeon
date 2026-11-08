import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './client'
import { ApiError } from './errors'
import type { AttemptRequest } from '../types/api'

type FetchArgs = [url: string | URL | Request, init?: RequestInit]

function fakeFetch(response: (() => Response) | Error) {
  return vi.fn(async (...args: FetchArgs) => {
    void args
    if (response instanceof Error) throw response
    return response()
  })
}

const json = (body: unknown, status = 200) => () =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('createHttpClient', () => {
  it('uses credentials include and the right URL/method for each call', async () => {
    const f = fakeFetch(json({}))
    const api = createHttpClient('http://api.test/', f as unknown as typeof fetch)

    await api.startDemoSession()
    await api.getDungeon('d 1')
    await api.startRun('d1')
    await api.submitAttempt('r1', { question_id: 'q', selected_answer: 'a', attempt_id: 'x' })
    await api.clearRoom('r1', 'room-1')

    const calls = f.mock.calls.map(([url, init]) => [String(url), init?.method])
    expect(calls).toEqual([
      ['http://api.test/demo/session', 'POST'],
      ['http://api.test/dungeons/d%201', 'GET'],
      ['http://api.test/runs', 'POST'],
      ['http://api.test/runs/r1/attempts', 'POST'],
      ['http://api.test/runs/r1/rooms/room-1/clear', 'POST'],
    ])
    for (const [, init] of f.mock.calls) expect(init?.credentials).toBe('include')
  })

  it('getProgress is GET /progress with credentials include and no body', async () => {
    const f = fakeFetch(json({ level: 2, total_xp: 120, xp_to_next: 80 }))
    const api = createHttpClient('http://api.test/', f as unknown as typeof fetch)
    const p = await api.getProgress()
    expect(p).toEqual({ level: 2, total_xp: 120, xp_to_next: 80 })
    expect(String(f.mock.calls[0][0])).toBe('http://api.test/progress')
    expect(f.mock.calls[0][1]?.method).toBe('GET')
    expect(f.mock.calls[0][1]?.credentials).toBe('include')
    expect(f.mock.calls[0][1]?.body).toBeUndefined()
  })

  it('maps getProgress errors to ApiError', async () => {
    const f = fakeFetch(json({ detail: 'no session' }, 401))
    const api = createHttpClient('', f as unknown as typeof fetch)
    const err = await api.getProgress().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(401)
  })

  it('sends finishRun without a body', async () => {
    const f = fakeFetch(json({ score: 1, xp: 2, correct: 3, total: 4, accuracy: 0.75 }))
    const api = createHttpClient('', f as unknown as typeof fetch)
    const summary = await api.finishRun('r1')
    expect(summary.accuracy).toBe(0.75)
    expect(f.mock.calls[0][1]?.body).toBeUndefined()
  })

  it('sends only attempt_id, question_id, selected_answer in the attempt body', async () => {
    const f = fakeFetch(json({}))
    const api = createHttpClient('', f as unknown as typeof fetch)
    const req = {
      question_id: 'q1',
      selected_answer: 'CPU',
      attempt_id: 'a1',
      damage_dealt: 999,
      correct: true,
    } as unknown as AttemptRequest
    await api.submitAttempt('r1', req)
    const body = JSON.parse(String(f.mock.calls[0][1]?.body)) as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(['attempt_id', 'question_id', 'selected_answer'])
  })

  it('throws ApiError with the HTTP status on non-2xx', async () => {
    const f = fakeFetch(json({ detail: 'nope' }, 429))
    const api = createHttpClient('', f as unknown as typeof fetch)
    const err = await api.startRun('d').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(429)
    expect((err as ApiError).message).toBe('nope')
  })

  it('maps network failure to ApiError status 0', async () => {
    const f = fakeFetch(new TypeError('failed'))
    const api = createHttpClient('', f as unknown as typeof fetch)
    const err = await api.startDemoSession().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(0)
  })
})
