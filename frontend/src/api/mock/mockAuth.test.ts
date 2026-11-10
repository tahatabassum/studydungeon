import { describe, expect, it } from 'vitest'
import { createMockAdapter } from './mockAdapter'
import { MOCK_FAIL_LIMIT, MOCK_SESSION_MS, createMockAuth, registerIssues } from './mockAuth'

const PW = 'correct-horse-9'

describe('mock auth (real Backend behaviour, C22 to C24)', () => {
  it('register returns a bare non-guest user with a normalized username and opens the session', async () => {
    const auth = createMockAuth()
    const user = await auth.register({ username: '  Ghost_Hunter ', password: PW })
    expect(user).toEqual({ id: 'user-1', username: 'ghost_hunter', is_guest: false })
    const me = await auth.getMe()
    expect(me?.user).toEqual(user)
    expect(typeof me?.expires_at).toBe('string')
  })

  it('409 for a taken username in any letter case', async () => {
    const auth = createMockAuth()
    await auth.register({ username: 'abc_def', password: PW })
    await expect(auth.register({ username: 'ABC_DEF', password: PW })).rejects.toMatchObject({ status: 409 })
    await expect(auth.register({ username: 'taken_name', password: PW })).rejects.toMatchObject({ status: 409 })
  })

  it('422 carries the FastAPI array form: one entry per invalid field', async () => {
    const auth = createMockAuth()
    const err = await auth.register({ username: 'ab', password: 'short' }).catch((e: unknown) => e)
    expect(err).toMatchObject({ status: 422, code: 'VALIDATION_ERROR' })
    expect((err as { fields: unknown }).fields).toEqual([
      { field: 'username', message: 'String should have at least 3 characters' },
      { field: 'password', message: 'String should have at least 8 characters' },
    ])
    expect(registerIssues({ username: 'guest_one', password: PW })[0].field).toBe('username')
    expect(registerIssues({ username: 'system_x', password: PW })).toHaveLength(1)
    expect(registerIssues({ username: 'bad name!', password: PW })).toHaveLength(1)
    expect(registerIssues({ username: 'fine_name', password: PW })).toEqual([])
  })

  it('401 for a wrong password or unknown user; the right password signs in', async () => {
    const auth = createMockAuth({ seed: [{ username: 'Seeded', password: PW }] })
    await expect(auth.login({ username: 'seeded', password: 'nope-nope' })).rejects.toMatchObject({ status: 401 })
    await expect(auth.login({ username: 'nobody', password: PW })).rejects.toMatchObject({ status: 401 })
    expect((await auth.login({ username: 'SEEDED', password: PW })).username).toBe('seeded')
  })

  it('429 with Retry-After after repeated failures, and again after the lock ends', async () => {
    let t = 1_000
    const auth = createMockAuth({ now: () => t, seed: [{ username: 'seeded', password: PW }] })
    for (let i = 0; i < MOCK_FAIL_LIMIT; i += 1) {
      await expect(auth.login({ username: 'seeded', password: 'wrong-pass' })).rejects.toMatchObject({ status: 401 })
    }
    await expect(auth.login({ username: 'seeded', password: PW })).rejects.toMatchObject({ status: 429, retryAfter: '10' })
    t += 11_000
    expect((await auth.login({ username: 'seeded', password: PW })).username).toBe('seeded')
  })

  it('magic names: ratelimit gives 429 with Retry-After 5, servererror gives 500', async () => {
    const auth = createMockAuth()
    await expect(auth.login({ username: 'ratelimit', password: PW })).rejects.toMatchObject({ status: 429, retryAfter: '5' })
    await expect(auth.register({ username: 'servererror', password: PW })).rejects.toMatchObject({ status: 500 })
  })

  it('logout ends the session; the session also ends after its time', async () => {
    let t = 0
    const auth = createMockAuth({ now: () => t })
    await auth.register({ username: 'abc_def', password: PW })
    await auth.logout()
    expect(await auth.getMe()).toBeNull()
    await auth.login({ username: 'abc_def', password: PW })
    t += MOCK_SESSION_MS + 1
    expect(await auth.getMe()).toBeNull()
  })

  it('the adapter exposes auth, and a demo session counts as a guest session for getMe', async () => {
    const api = createMockAdapter()
    expect(await api.getMe()).toBeNull()
    const session = await api.startDemoSession()
    expect((await api.getMe())?.user).toEqual(session.user)
    await api.logout()
    expect(await api.getMe()).toBeNull()
  })

  it('stores nothing in browser storage', async () => {
    const api = createMockAdapter()
    await api.register({ username: 'abc_def', password: PW })
    await api.login({ username: 'abc_def', password: PW })
    localStorage.removeItem('sd.introSeen') // test-setup flags, not written by the adapter
    localStorage.removeItem('sd.tutorialSeen')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
})
