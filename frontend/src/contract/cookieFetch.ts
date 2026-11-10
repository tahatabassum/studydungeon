/**
 * Test-only fetch with a minimal cookie jar. Browsers keep the HttpOnly session cookie themselves
 * (credentials: 'include'); Node's fetch does not, so the real-backend contract run needs this.
 */
export function createCookieFetch(inner: typeof fetch = fetch): typeof fetch {
  const jar = new Map<string, string>()
  return async (input, init) => {
    const headers = new Headers(init?.headers)
    if (jar.size > 0) headers.set('Cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '))
    const res = await inner(input, { ...init, headers })
    for (const line of res.headers.getSetCookie()) {
      const [pair = ''] = line.split(';')
      const eq = pair.indexOf('=')
      if (eq > 0) {
        const name = pair.slice(0, eq).trim()
        const value = pair.slice(eq + 1).trim()
        if (value === '') jar.delete(name)
        else jar.set(name, value)
      }
    }
    return res
  }
}
