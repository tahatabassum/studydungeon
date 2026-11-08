import { describe, expect, it } from 'vitest'
import { createCookieFetch } from './cookieFetch'

describe('createCookieFetch', () => {
  it('stores Set-Cookie from a response and sends it on the next request', async () => {
    const seen: (string | null)[] = []
    const inner = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get('Cookie'))
      const headers = new Headers()
      if (seen.length === 1) headers.append('Set-Cookie', 'studydungeon_session=abc.def; HttpOnly; Max-Age=86400; Path=/; SameSite=lax')
      return new Response('{}', { headers })
    }) as typeof fetch
    const f = createCookieFetch(inner)
    await f('http://x/demo/session', { method: 'POST' })
    await f('http://x/progress')
    expect(seen).toEqual([null, 'studydungeon_session=abc.def'])
  })
})
