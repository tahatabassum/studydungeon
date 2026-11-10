import { ApiError, type FieldIssue } from '../errors'
import type { AuthMe, Credentials, User } from '../../types/api'

/**
 * MOCK-ONLY auth: an in-memory user table that behaves like the real Backend (C22 to C24).
 * The session is a variable in this closure, the stand-in for the httpOnly cookie: nothing is written to
 * localStorage or sessionStorage. The table is wiped when the page reloads.
 *
 * Triggers for the demo (try them in the forms):
 *  - register "taken_name" (or any name already registered): 409
 *  - a short username or password, or a reserved name: 422 with an array `detail`
 *  - login with a wrong password five times in a row: 429 with Retry-After 10
 *  - username "ratelimit": always 429 with Retry-After 5
 *  - username "servererror": 500
 */
export const MOCK_SESSION_MS = 24 * 60 * 60 * 1000
export const MOCK_FAIL_LIMIT = 5
export const MOCK_RETRY_AFTER_S = 10

export interface MockAuthOptions {
  /** Clock in ms. Default Date.now (used for the session expiry and the lock window only). */
  now?: () => number
  /** Users that exist from the start (username is normalized, password kept as given). */
  seed?: readonly Credentials[]
}

/** Same normalization as the Backend: NFKC, trimmed, lowercase. */
export function normalizeUsername(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase()
}

/** Backend rules (C23) as 422 field issues. Empty when the credentials are valid. */
export function registerIssues(raw: Credentials): FieldIssue[] {
  const issues: FieldIssue[] = []
  const name = normalizeUsername(raw.username)
  if (raw.username.length < 3) {
    issues.push({ field: 'username', message: 'String should have at least 3 characters' })
  } else if (raw.username.length > 32 || name.length > 32 || name.length < 3) {
    issues.push({ field: 'username', message: 'Value error, Username must be between 3 and 32 characters after normalization' })
  } else if (name.startsWith('guest_')) {
    issues.push({ field: 'username', message: "Value error, Usernames starting with 'guest_' are reserved for demo guest accounts" })
  } else if (name === 'system' || name.startsWith('system_')) {
    issues.push({ field: 'username', message: "Value error, Usernames starting with 'system' or 'system_' are reserved for system services" })
  } else if (!/^[a-z0-9_]+$/.test(name)) {
    issues.push({ field: 'username', message: 'Value error, Username must contain only alphanumeric characters and underscores' })
  }
  if (raw.password.length < 8) issues.push({ field: 'password', message: 'String should have at least 8 characters' })
  else if (raw.password.length > 128) issues.push({ field: 'password', message: 'String should have at most 128 characters' })
  return issues
}

export interface MockAuth {
  register(credentials: Credentials): Promise<User>
  login(credentials: Credentials): Promise<User>
  logout(): Promise<void>
  getMe(): Promise<AuthMe | null>
  /** Mock adapter hook: the demo session is a session too, so `getMe` agrees with it. */
  adopt(user: User): void
}

function unprocessable(issues: FieldIssue[]): ApiError {
  return new ApiError(422, issues[0].message, 'VALIDATION_ERROR', { fields: issues })
}

export function createMockAuth(options: MockAuthOptions = {}): MockAuth {
  const now = options.now ?? Date.now
  const users = new Map<string, { user: User; password: string }>()
  let counter = 0
  let current: User | null = null
  let expiresAt = 0
  let failures = 0
  let lockedUntil = 0

  const open = (user: User): User => {
    current = user
    expiresAt = now() + MOCK_SESSION_MS
    return { ...user }
  }
  const add = (username: string, password: string): User => {
    counter += 1
    const user: User = { id: `user-${counter}`, username, is_guest: false }
    users.set(username, { user, password })
    return user
  }
  for (const c of options.seed ?? []) add(normalizeUsername(c.username), c.password)

  const guard = (name: string): void => {
    if (name === 'servererror') throw new ApiError(500, 'Internal Server Error')
    if (name === 'ratelimit') throw new ApiError(429, 'Too many attempts', 'RATE_LIMITED', { retryAfter: '5' })
    const wait = lockedUntil - now()
    if (wait > 0) {
      throw new ApiError(429, 'Too many attempts', 'RATE_LIMITED', { retryAfter: String(Math.max(1, Math.ceil(wait / 1000))) })
    }
  }

  return {
    async register(credentials) {
      const name = normalizeUsername(credentials.username)
      guard(name)
      const issues = registerIssues(credentials)
      if (issues.length > 0) throw unprocessable(issues)
      if (users.has(name) || name === 'taken_name') throw new ApiError(409, 'Username already taken', 'USERNAME_TAKEN')
      return open(add(name, credentials.password))
    },

    async login(credentials) {
      const name = normalizeUsername(credentials.username)
      guard(name)
      if (!name || !credentials.password) {
        throw unprocessable([{ field: name ? 'password' : 'username', message: 'Field required' }])
      }
      const found = users.get(name)
      if (!found || found.password !== credentials.password) {
        failures += 1
        if (failures >= MOCK_FAIL_LIMIT) {
          failures = 0
          lockedUntil = now() + MOCK_RETRY_AFTER_S * 1000
        }
        throw new ApiError(401, 'Invalid username or password', 'INVALID_CREDENTIALS')
      }
      failures = 0
      return open(found.user)
    },

    async logout() {
      current = null
    },

    async getMe() {
      if (!current || now() >= expiresAt) return null
      return { user: { ...current }, expires_at: new Date(expiresAt).toISOString() }
    },

    adopt(user) {
      open(user)
    },
  }
}
