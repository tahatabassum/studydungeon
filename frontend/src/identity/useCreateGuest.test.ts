import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ api: null as unknown, createOffline: null as unknown as (...a: unknown[]) => unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => (actual.isApiOverridden() ? actual.getApi() : Promise.resolve(h.api as never)) }
})
vi.mock('@/offline', () => ({ createOfflineAdapter: (...a: unknown[]) => h.createOffline(...a) }))

import { ApiError, isApiOverridden, setApiOverride } from '@/api'
import { SessionProvider, useSession } from '@/state/SessionContext'
import type { CreateGuestResponse, DemoSessionResponse, User } from '@/types/api'
import { OFFLINE_OFFER_MS, WAKE_MAX_MS } from './wakeConstants'
import { retryAfterSeconds, useCreateGuest } from './useCreateGuest'

const user: User = { id: 'u1', username: '', is_guest: true, display_name: 'Hollow Raven', tag: '1234', handle: 'Hollow Raven#1234' }
const created: CreateGuestResponse = { user, notice_version: '1' }
const demoSession: DemoSessionResponse = {
  user: { id: 'd1', username: 'guest_x', is_guest: true },
  dungeon_id: 'legacy-dungeon',
  expires_at: '2030-01-01T00:00:00Z',
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

interface FakeApi {
  capabilities?: { guestIdentity?: boolean }
  createGuest: ReturnType<typeof vi.fn>
  getMe: ReturnType<typeof vi.fn>
  startDemoSession: ReturnType<typeof vi.fn>
}

function setup(over: Partial<FakeApi> = {}) {
  const api: FakeApi = {
    createGuest: vi.fn(() => new Promise(() => {})),
    getMe: vi.fn(() => Promise.resolve(null)),
    startDemoSession: vi.fn(() => Promise.resolve(demoSession)),
    ...over,
  }
  h.api = api
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: ['/play-as-guest'] }, createElement(SessionProvider, null, children))
  const view = renderHook(
    () => ({ create: useCreateGuest(), path: useLocation().pathname, session: useSession() }),
    { wrapper },
  )
  return { api, ...view }
}

const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

beforeEach(() => {
  vi.useFakeTimers()
  h.createOffline = vi.fn(() => ({
    startDemoSession: () => Promise.resolve({ ...demoSession, dungeon_id: 'demo-dungeon' }),
  }))
})
afterEach(() => {
  vi.useRealTimers()
  setApiOverride(null)
  cleanup()
})

describe('useCreateGuest', () => {
  it('submits once with accept_public_notice true and ignores repeats while pending', async () => {
    const { api, result } = setup()
    await act(async () => {
      void result.current.create.submit('Hollow Raven')
      void result.current.create.submit('Hollow Raven')
    })
    expect(api.createGuest).toHaveBeenCalledTimes(1)
    expect(api.createGuest).toHaveBeenCalledWith({ display_name: 'Hollow Raven', accept_public_notice: true })
    expect(result.current.create.pending).toBe(true)
  })

  it('success sets the user and goes to /choose', async () => {
    const { result } = setup({ createGuest: vi.fn(() => Promise.resolve(created)) })
    await act(async () => void (await result.current.create.submit('Hollow Raven')))
    expect(result.current.path).toBe('/choose')
    expect(result.current.session.user?.handle).toBe('Hollow Raven#1234')
  })

  it('shows the two choices at 8 s, not before, and never starts the offline demo', async () => {
    const { result } = setup()
    await act(async () => void result.current.create.submit('Hollow Raven'))
    await tick(OFFLINE_OFFER_MS - 1)
    expect(result.current.create.offerOffline).toBe(false)
    await tick(1)
    expect(result.current.create.offerOffline).toBe(true)
    expect(h.createOffline).not.toHaveBeenCalled()
    expect(isApiOverridden()).toBe(false)
  })

  it('Keep waiting keeps the request alive until 60 s since the start, then times out without going offline', async () => {
    const { api, result } = setup()
    await act(async () => void result.current.create.submit('Hollow Raven'))
    await tick(OFFLINE_OFFER_MS)
    act(() => result.current.create.keepWaiting())
    expect(result.current.create.keptWaiting).toBe(true)
    await tick(WAKE_MAX_MS - OFFLINE_OFFER_MS - 1)
    expect(result.current.create.timedOut).toBe(false)
    expect(result.current.create.pending).toBe(true)
    await tick(1)
    expect(result.current.create.timedOut).toBe(true)
    expect(result.current.create.pending).toBe(true)
    expect(api.createGuest).toHaveBeenCalledTimes(1)
    expect(h.createOffline).not.toHaveBeenCalled()
    expect(isApiOverridden()).toBe(false)
  })

  it('Retry after the timeout sends a new request and ignores the old answer', async () => {
    const first = deferred<CreateGuestResponse>()
    const createGuest = vi.fn().mockReturnValueOnce(first.promise).mockReturnValue(new Promise(() => {}))
    const { result } = setup({ createGuest })
    await act(async () => void result.current.create.submit('Hollow Raven'))
    await tick(WAKE_MAX_MS)
    expect(result.current.create.timedOut).toBe(true)
    await act(async () => void result.current.create.retry())
    expect(createGuest).toHaveBeenCalledTimes(2)
    expect(result.current.create.timedOut).toBe(false)
    await act(async () => {
      first.resolve(created)
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.path).toBe('/play-as-guest')
  })

  it('a success while the choices are shown continues to /choose', async () => {
    const d = deferred<CreateGuestResponse>()
    const { result } = setup({ createGuest: vi.fn(() => d.promise) })
    await act(async () => void result.current.create.submit('Hollow Raven'))
    await tick(OFFLINE_OFFER_MS)
    expect(result.current.create.offerOffline).toBe(true)
    await act(async () => {
      d.resolve(created)
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.path).toBe('/choose')
    expect(result.current.create.offerOffline).toBe(false)
    expect(h.createOffline).not.toHaveBeenCalled()
  })

  it('a success while the timeout error is shown continues to /choose', async () => {
    const d = deferred<CreateGuestResponse>()
    const { result } = setup({ createGuest: vi.fn(() => d.promise) })
    await act(async () => void result.current.create.submit('Hollow Raven'))
    await tick(WAKE_MAX_MS)
    await act(async () => {
      d.resolve(created)
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.path).toBe('/choose')
  })

  it('choosing offline loads the demo only on the click; a late success is then ignored', async () => {
    const d = deferred<CreateGuestResponse>()
    const { result } = setup({ createGuest: vi.fn(() => d.promise) })
    await act(async () => void result.current.create.submit('Hollow Raven'))
    await tick(OFFLINE_OFFER_MS)
    expect(h.createOffline).not.toHaveBeenCalled()
    await act(async () => void (await result.current.create.chooseOffline()))
    expect(h.createOffline).toHaveBeenCalledTimes(1)
    expect(isApiOverridden()).toBe(true)
    expect(result.current.path).toBe('/campaign/demo-dungeon')
    await act(async () => {
      d.resolve(created)
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.path).toBe('/campaign/demo-dungeon')
  })

  it('409 SESSION_EXISTS reads getMe, sets the user and goes to /choose', async () => {
    const getMe = vi.fn(() => Promise.resolve({ user, expires_at: null }))
    const createGuest = vi.fn(() => Promise.reject(new ApiError(409, 'exists', 'SESSION_EXISTS')))
    const { result } = setup({ createGuest, getMe })
    await act(async () => void (await result.current.create.submit('Hollow Raven')))
    expect(result.current.path).toBe('/choose')
    expect(result.current.session.user?.id).toBe('u1')
  })

  it('409 SESSION_EXISTS with no user from getMe shows a generic Try again error', async () => {
    const createGuest = vi.fn(() => Promise.reject(new ApiError(409, 'exists', 'SESSION_EXISTS')))
    const { result } = setup({ createGuest })
    await act(async () => void (await result.current.create.submit('Hollow Raven')))
    expect(result.current.path).toBe('/play-as-guest')
    expect(result.current.create.error).toBe('Something went wrong. Please try again.')
  })

  it('503 GUEST_CREATION_PAUSED shows the message and the offline offer, but does not start offline', async () => {
    const createGuest = vi.fn(() => Promise.reject(new ApiError(503, 'paused', 'GUEST_CREATION_PAUSED')))
    const { result } = setup({ createGuest })
    await act(async () => void (await result.current.create.submit('Hollow Raven')))
    expect(result.current.create.paused).toBe(true)
    expect(result.current.create.error).toBe('The dungeon is full for this hour. Try again later, or play the offline demo.')
    await tick(WAKE_MAX_MS)
    expect(h.createOffline).not.toHaveBeenCalled()
    expect(isApiOverridden()).toBe(false)
  })

  it('429 shows the wait time from retry_after_seconds or the Retry-After header', async () => {
    const a = setup({
      createGuest: vi.fn(() => Promise.reject(new ApiError(429, 'slow', 'RATE_LIMIT_EXCEEDED', { retry_after_seconds: 120 }))),
    })
    await act(async () => void (await a.result.current.create.submit('Hollow Raven')))
    expect(a.result.current.create.error).toContain('120 seconds')
    cleanup()
    const b = setup({
      createGuest: vi.fn(() => Promise.reject(new ApiError(429, 'slow', undefined, { retryAfter: '30' }))),
    })
    await act(async () => void (await b.result.current.create.submit('Hollow Raven')))
    expect(b.result.current.create.error).toContain('30 seconds')
  })

  it('reads an HTTP-date Retry-After', () => {
    const now = Date.parse('2030-01-01T00:00:00Z')
    const err = new ApiError(429, 'slow', undefined, { retryAfter: 'Tue, 01 Jan 2030 00:01:00 GMT' })
    expect(retryAfterSeconds(err, now)).toBe(60)
  })

  it('NAME_INVALID shows the reason message and flags the name', async () => {
    const createGuest = vi.fn(() => Promise.reject(new ApiError(422, 'bad', 'NAME_INVALID', { reason: 'not_allowed' })))
    const { result } = setup({ createGuest })
    await act(async () => void (await result.current.create.submit('Hollow Raven')))
    expect(result.current.create.error).toBe('That name is not available. Try another.')
    expect(result.current.create.nameInvalid).toBe(true)
    expect(result.current.create.pending).toBe(false)
  })

  it('guestIdentity off falls back to POST /demo/session and opens the returned dungeon', async () => {
    const { api, result } = setup({ capabilities: { guestIdentity: false } })
    await act(async () => void (await result.current.create.submit('Hollow Raven')))
    await tick(0)
    expect(api.createGuest).not.toHaveBeenCalled()
    expect(api.startDemoSession).toHaveBeenCalledTimes(1)
    expect(result.current.path).toBe('/campaign/legacy-dungeon')
    expect(result.current.create.legacy).toBe(true)
  })

  it('a 404 from createGuest falls back to the legacy demo session, with the same waking flow and no auto offline', async () => {
    const d = deferred<DemoSessionResponse>()
    const createGuest = vi.fn(() => Promise.reject(new ApiError(404, 'nope')))
    const { api, result } = setup({ createGuest, startDemoSession: vi.fn(() => d.promise) })
    await act(async () => void (await result.current.create.submit('Hollow Raven')))
    await tick(0)
    expect(api.startDemoSession).toHaveBeenCalledTimes(1)
    expect(result.current.create.legacy).toBe(true)
    expect(result.current.create.pending).toBe(true)
    await tick(OFFLINE_OFFER_MS)
    expect(result.current.create.offerOffline).toBe(true)
    act(() => result.current.create.keepWaiting())
    await tick(WAKE_MAX_MS)
    expect(result.current.create.timedOut).toBe(true)
    expect(h.createOffline).not.toHaveBeenCalled()
    await act(async () => {
      d.resolve(demoSession)
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.path).toBe('/campaign/legacy-dungeon')
  })
})
