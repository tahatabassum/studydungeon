import { describe, expect, it, vi } from 'vitest'
import { createHttpClient, HTTP_CAPABILITIES } from './client'
import { capabilityOf } from './ApiClient'
import { ApiError, friendlyMessage } from './errors'

type FetchArgs = [url: string | URL | Request, init?: RequestInit]

function respond(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return vi.fn(async (...args: FetchArgs) => {
    void args
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
  })
}

const user = { id: 'u1', username: null, is_guest: true, display_name: 'Ada', tag: '1234', handle: 'Ada#1234', public_id: 'p1' }

describe('Http_Client identity calls (frontend-10 task 3.2)', () => {
  it('starts with REAL features on and PROPOSED ones unproven, keeping the old flags', () => {
    expect(HTTP_CAPABILITIES).toMatchObject({
      roomRevenants: false,
      floors: false,
      modes: false,
      dailyHaunt: false,
      leaderboard: false,
      guestIdentity: true,
      accountUpgrade: true,
      accountDelete: true,
      packs: 'unproven',
      liveBoard: 'unproven',
      playerCounter: 'unproven',
      uploadQuota: 'unproven',
      guestUpload: 'unproven',
    })
  })

  it('checkGuestName posts {display_name}', async () => {
    const f = respond({ ok: true, display_name: 'Ada' })
    const api = createHttpClient('http://api', f as unknown as typeof fetch)
    expect(await api.checkGuestName('Ada')).toEqual({ ok: true, display_name: 'Ada' })
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('http://api/guests/name-check')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', body: JSON.stringify({ display_name: 'Ada' }) })
  })

  it('createGuest posts the name with accept_public_notice true', async () => {
    const f = respond({ user, notice_version: 'v1' }, 201)
    const api = createHttpClient('http://api', f as unknown as typeof fetch)
    const out = await api.createGuest({ display_name: 'Ada', accept_public_notice: true })
    expect(out.notice_version).toBe('v1')
    expect(out.user.display_name).toBe('Ada')
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('http://api/guests')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(JSON.parse(String(init?.body))).toEqual({ display_name: 'Ada', accept_public_notice: true })
  })

  it('upgradeGuest posts the credentials to /auth/upgrade', async () => {
    const f = respond({ id: 'u1', username: 'ada', is_guest: false })
    const api = createHttpClient('http://api', f as unknown as typeof fetch)
    const u = await api.upgradeGuest({ username: 'ada', password: 'secret123' })
    expect(u).toMatchObject({ username: 'ada', is_guest: false })
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('http://api/auth/upgrade')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(JSON.parse(String(init?.body))).toEqual({ username: 'ada', password: 'secret123' })
  })

  it('deleteAccount sends DELETE /auth/me with {confirm:"DELETE"}', async () => {
    const f = respond({ success: true, message: 'gone' })
    const api = createHttpClient('http://api', f as unknown as typeof fetch)
    await expect(api.deleteAccount()).resolves.toBeUndefined()
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('http://api/auth/me')
    expect(init).toMatchObject({ method: 'DELETE', credentials: 'include' })
    expect(JSON.parse(String(init?.body))).toEqual({ confirm: 'DELETE' })
  })

  it('listDungeons gets /dungeons', async () => {
    const f = respond([{ id: 'd1', title: 'Demo', is_public_demo: true, created_at: '2025-01-01', rooms_count: 3 }])
    const api = createHttpClient('http://api', f as unknown as typeof fetch)
    const list = await api.listDungeons()
    expect(list).toHaveLength(1)
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('http://api/dungeons')
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' })
  })
})

describe('capability transitions', () => {
  it.each([404, 405, 501])('turns guestIdentity off on %i', async (status) => {
    const api = createHttpClient('', respond({ detail: 'x' }, status) as unknown as typeof fetch)
    await expect(api.createGuest({ display_name: 'Ada', accept_public_notice: true })).rejects.toBeInstanceOf(ApiError)
    expect(capabilityOf(api, 'guestIdentity')).toBe('off')
    expect(capabilityOf(api, 'accountUpgrade')).toBe('on')
  })

  it('turns accountDelete and accountUpgrade off on 404', async () => {
    const api = createHttpClient('', respond({ detail: 'x' }, 404) as unknown as typeof fetch)
    await expect(api.deleteAccount()).rejects.toBeInstanceOf(ApiError)
    await expect(api.upgradeGuest({ username: 'a', password: 'b' })).rejects.toBeInstanceOf(ApiError)
    expect(capabilityOf(api, 'accountDelete')).toBe('off')
    expect(capabilityOf(api, 'accountUpgrade')).toBe('off')
  })

  it.each([400, 401, 409, 422, 429, 500, 503])('leaves capabilities unchanged on %i', async (status) => {
    const api = createHttpClient('', respond({ detail: { code: 'X', message: 'm' } }, status) as unknown as typeof fetch)
    await expect(api.checkGuestName('Ada')).rejects.toBeInstanceOf(ApiError)
    expect(capabilityOf(api, 'guestIdentity')).toBe('on')
  })

  it('leaves capabilities unchanged on a network error', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('offline')
    })
    const api = createHttpClient('', f as unknown as typeof fetch)
    await expect(api.deleteAccount()).rejects.toMatchObject({ status: 0 })
    expect(capabilityOf(api, 'accountDelete')).toBe('on')
  })

  it('keeps other clients independent of one client turning a flag off', async () => {
    const a = createHttpClient('', respond({}, 404) as unknown as typeof fetch)
    const b = createHttpClient('', respond({}, 200) as unknown as typeof fetch)
    await a.deleteAccount().catch(() => undefined)
    expect(capabilityOf(a, 'accountDelete')).toBe('off')
    expect(capabilityOf(b, 'accountDelete')).toBe('on')
  })
})

describe('ApiError extras and friendly messages', () => {
  it('keeps detail extras on the error', async () => {
    const detail = { code: 'NAME_INVALID', message: 'bad', reason: 'too_short', retry_after_seconds: 30, limit: 5, found: 7, offer_packs: true }
    const api = createHttpClient('', respond({ detail }, 422, { 'Retry-After': '30' }) as unknown as typeof fetch)
    const err = (await api.createGuest({ display_name: 'x', accept_public_notice: true }).catch((e: unknown) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({
      status: 422,
      code: 'NAME_INVALID',
      reason: 'too_short',
      retry_after_seconds: 30,
      limit: 5,
      found: 7,
      offer_packs: true,
      retryAfter: '30',
    })
  })

  it.each([
    'NAME_INVALID',
    'NOTICE_NOT_ACCEPTED',
    'SESSION_EXISTS',
    'GUEST_CREATION_PAUSED',
    'NOT_A_GUEST',
    'USERNAME_TAKEN',
    'CONFIRMATION_REQUIRED',
    'SYSTEM_USER_PROTECTED',
  ])('has a friendly message for %s', (code) => {
    expect(friendlyMessage(code, 400)).toBeTruthy()
  })
})

describe('warmUp', () => {
  it('sends one GET /health with credentials omitted, once per client', async () => {
    const f = respond({ status: 'ok' })
    const api = createHttpClient('http://api', f as unknown as typeof fetch)
    await api.warmUp?.()
    await api.warmUp?.()
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('http://api/health')
    expect(init).toMatchObject({ method: 'GET', credentials: 'omit' })
  })

  it('swallows errors', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('offline')
    })
    const api = createHttpClient('', f as unknown as typeof fetch)
    await expect(api.warmUp?.()).resolves.toBeUndefined()
  })
})
