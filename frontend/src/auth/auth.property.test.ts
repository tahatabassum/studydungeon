import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/errors'
import { FALLBACK_MESSAGE, NETWORK_MESSAGE, SERVER_MESSAGE, mapAuthError, messageForStatus } from './errors'
import { DEFAULT_RETRY_AFTER_S, MAX_RETRY_AFTER_S, parseRetryAfter } from './retryAfter'
import {
  normalizeUsername,
  validateLoginPassword,
  validateRegisterPassword,
  validateUsername,
} from './validation'

// Feature: frontend-07-premium-ux-leaderboard, Property 17: Auth validation and messages
// **Validates: Requirements 13.1, 13.3, 13.4, 13.7**

const NAME_OK = /^[a-z0-9_]{3,32}$/
const wordChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('')
const validName = fc
  .array(fc.constantFrom(...wordChars), { minLength: 3, maxLength: 32 })
  .map((cs) => cs.join(''))
  .filter((s) => !/^(guest_|system)/i.test(s))

describe('Property 17: Auth validation and messages', () => {
  it('a username is accepted exactly when its lowercase form is 3 to 32 letters, digits or underscores and not reserved', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (raw) => {
        const name = normalizeUsername(raw)
        const ok = NAME_OK.test(name) && !name.startsWith('guest_') && !name.startsWith('system')
        expect(validateUsername(raw) === null).toBe(ok)
      }),
      { numRuns: 200 },
    )
  })

  it('every well-formed name is accepted in any letter case, and reserved prefixes are refused', () => {
    fc.assert(
      fc.property(validName, fc.boolean(), (name, upper) => {
        expect(validateUsername(upper ? name.toUpperCase() : name)).toBeNull()
        expect(validateUsername(`guest_${name}`.slice(0, 32))).toBe('reserved')
        expect(validateUsername(`System${name}`.slice(0, 32))).toBe('reserved')
      }),
      { numRuns: 100 },
    )
  })

  it('register passwords are accepted exactly from 8 to 128 characters; login only needs a value', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 140 }), (pw) => {
        expect(validateRegisterPassword(pw) === null).toBe(pw.length >= 8 && pw.length <= 128)
        expect(validateLoginPassword(pw) === null).toBe(pw.length > 0)
      }),
      { numRuns: 200 },
    )
  })

  it('Retry-After seconds round trip, and anything unusable falls back to 10 seconds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: MAX_RETRY_AFTER_S }), (n) => {
        expect(parseRetryAfter(String(n))).toBe(n)
      }),
      { numRuns: 100 },
    )
    fc.assert(
      fc.property(fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant(''), fc.constant('0'), fc.constant('-5'), fc.constant('soon')), (v) => {
        expect(parseRetryAfter(v)).toBe(DEFAULT_RETRY_AFTER_S)
      }),
      { numRuns: 50 },
    )
    fc.assert(
      fc.property(fc.option(fc.string({ maxLength: 20 }), { nil: undefined }), (v) => {
        const s = parseRetryAfter(v)
        expect(Number.isInteger(s)).toBe(true)
        expect(s).toBeGreaterThanOrEqual(1)
        expect(s).toBeLessThanOrEqual(MAX_RETRY_AFTER_S)
      }),
      { numRuns: 100 },
    )
  })

  it('401, 409, 422, 429 and 5xx each give a friendly sentence with no status code in it', () => {
    const statuses = fc.oneof(fc.constantFrom(401, 409, 422, 429), fc.integer({ min: 500, max: 599 }))
    fc.assert(
      fc.property(statuses, fc.constantFrom('login', 'register') as fc.Arbitrary<'login' | 'register'>, (status, mode) => {
        const view = mapAuthError(new ApiError(status, 'raw backend text'), mode)
        expect(view.message.length).toBeGreaterThan(10)
        expect(view.message).not.toMatch(/\b(401|409|422|429|5\d\d)\b/)
        expect(view.message).not.toContain('raw backend text')
        if (status >= 500) expect(view.message).toBe(SERVER_MESSAGE)
        if (status === 429) expect(view.retryAfter).toBe(DEFAULT_RETRY_AFTER_S)
        else expect(view.retryAfter).toBeUndefined()
        expect(messageForStatus(status, mode)).toBeTruthy()
      }),
      { numRuns: 100 },
    )
  })

  it('a 422 array detail lands next to the field it names; other errors fall back', () => {
    fc.assert(
      fc.property(fc.constantFrom('username', 'password'), fc.string({ minLength: 1, maxLength: 30 }), (field, msg) => {
        const view = mapAuthError(new ApiError(422, msg, 'VALIDATION_ERROR', { fields: [{ field, message: `Value error, ${msg}` }] }), 'register')
        const shown = view.fields[field as 'username' | 'password']
        expect(shown).toBeDefined()
        expect(shown).not.toMatch(/^value error/i)
      }),
      { numRuns: 100 },
    )
    expect(mapAuthError(new ApiError(0, 'Network error')).message).toBe(NETWORK_MESSAGE)
    expect(mapAuthError(new Error('boom')).message).toBe(FALLBACK_MESSAGE)
  })
})
