import { describe, expect, it, vi } from 'vitest'
import { createHttpClient } from './client'
import { ApiError } from './errors'

type FetchArgs = [url: string | URL | Request, init?: RequestInit]

const wireUser = { id: 'u-1', username: 'ghost_hunter', is_guest: false, created_at: '2025-01-01T00:00:00Z', expires_at: null }

function reply(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

function clientWith(handler: (path: string, init?: RequestInit) => Response) {
  const f = vi.fn(async (...args: FetchArgs) => handler(new URL(String(args[0]), 'http://x').pathname, args[1]))
  return { api: createHttpClient('', f as unknown as typeof fetch), f }
}

describe('Http_Client auth uses the real Backend bodies (C22 to C25)', () => {
  it('register: 201 with a bare user, sends the credentials as JSON with credentials: include', async () => {
    const { api, f } = clientWith(() => reply(201, wireUser))
    const user = await api.register({ username: 'Ghost_Hunter', password: 'correct-horse-9' })
    expect(user).toEqual({ id: 'u-1', username: 'ghost_hunter', is_guest: false })
    const [url, init] = f.mock.calls[0]
    expect(String(url)).toBe('/auth/register')
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('include')
    expect(JSON.parse(String(init?.body))).toEqual({ username: 'Ghost_Hunter', password: 'correct-horse-9' })
  })

  it('login: 200 with a bare user', async () => {
    const { api, f } = clientWith(() => reply(200, wireUser))
    expect(await api.login({ username: 'ghost_hunter', password: 'x' })).toMatchObject({ username: 'ghost_hunter', is_guest: false })
    expect(String(f.mock.calls[0][0])).toBe('/auth/login')
  })

  it('logout: 200 {success: true} resolves with nothing', async () => {
    const { api, f } = clientWith(() => reply(200, { success: true }))
    await expect(api.logout()).resolves.toBeUndefined()
    expect(String(f.mock.calls[0][0])).toBe('/auth/logout')
  })

  it('getMe: a bare user with expires_at', async () => {
    const { api } = clientWith(() => reply(200, { ...wireUser, is_guest: true, expires_at: '2030-01-01T00:00:00Z' }))
    expect(await api.getMe()).toEqual({
      user: { id: 'u-1', username: 'ghost_hunter', is_guest: true },
      expires_at: '2030-01-01T00:00:00Z',
    })
  })

  it('getMe: 401 means signed out (null); other failures still throw', async () => {
    expect(await clientWith(() => reply(401, { detail: 'Not authenticated' })).api.getMe()).toBeNull()
    await expect(clientWith(() => reply(500, { detail: 'boom' })).api.getMe()).rejects.toMatchObject({ status: 500 })
  })

  it('401, 409 and 5xx surface as ApiError with the status', async () => {
    for (const status of [401, 409, 500]) {
      const { api } = clientWith(() => reply(status, { detail: 'nope' }))
      await expect(api.login({ username: 'a', password: 'b' })).rejects.toMatchObject({ status })
    }
  })

  it('422 with an array detail keeps one entry per field', async () => {
    const detail = [
      { loc: ['body', 'username'], msg: 'String should have at least 3 characters', type: 'string_too_short' },
      { loc: ['body', 'password'], msg: 'String should have at least 8 characters', type: 'string_too_short' },
    ]
    const { api } = clientWith(() => reply(422, { detail }))
    const err = await api.register({ username: 'ab', password: 'short' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      fields: [
        { field: 'username', message: 'String should have at least 3 characters' },
        { field: 'password', message: 'String should have at least 8 characters' },
      ],
    })
  })

  it('429 keeps the Retry-After header as sent', async () => {
    const { api } = clientWith(() => reply(429, { detail: 'Too many attempts' }, { 'Retry-After': '42' }))
    await expect(api.login({ username: 'a', password: 'b' })).rejects.toMatchObject({ status: 429, retryAfter: '42' })
  })

  it('a body that is not a user is a contract error naming the endpoint', async () => {
    const { api } = clientWith(() => reply(200, { user: wireUser }))
    await expect(api.login({ username: 'a', password: 'b' })).rejects.toThrow(/POST \/auth\/login/)
  })

  it('writes nothing to browser storage', async () => {
    const { api } = clientWith(() => reply(200, wireUser))
    await api.login({ username: 'a', password: 'b' })
    localStorage.removeItem('sd.introSeen') // test-setup flags, not written by the client
    localStorage.removeItem('sd.tutorialSeen')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})
