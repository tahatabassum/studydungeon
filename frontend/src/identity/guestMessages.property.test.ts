import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { describeGuestError, reasonMessage } from './guestMessages'

// Feature: frontend-10-live-players, Property 2: Server name reasons always map to a friendly message
// **Validates: Requirements 2.8, 2.11, 2.12**

const KNOWN_REASONS = ['too_short', 'too_long', 'characters', 'not_allowed']
const KNOWN_CODES = [
  'NAME_INVALID',
  'NOTICE_NOT_ACCEPTED',
  'SESSION_EXISTS',
  'GUEST_CREATION_PAUSED',
  'RATE_LIMIT_EXCEEDED',
  'NOT_A_GUEST',
  'USERNAME_TAKEN',
  'CONFIRMATION_REQUIRED',
  'SYSTEM_USER_PROTECTED',
]

const reasonArb = fc.oneof(
  fc.constantFrom(...KNOWN_REASONS),
  fc.string(),
  fc.constant(null),
  fc.constant(undefined),
)
const codeArb = fc.oneof(
  fc.constantFrom(...KNOWN_CODES),
  fc.string(),
  fc.constant(null),
  fc.constant(undefined),
)
const retryArb = fc.oneof(
  fc.double({ noNaN: false }),
  fc.integer(),
  fc.constantFrom(NaN, Infinity, -Infinity, 0, -1, 1, 1e300, Number.MAX_VALUE),
  fc.constant(null),
  fc.constant(undefined),
)

function assertFriendly(msg: string) {
  expect(typeof msg).toBe('string')
  expect(msg.length).toBeGreaterThan(0)
  expect(msg).toBe(msg.trim())
  for (const code of KNOWN_CODES) expect(msg).not.toContain(code)
  // Raw snake_case reason tokens (the plain word "characters" is legitimate prose)
  for (const reason of KNOWN_REASONS.filter((r) => r.includes('_'))) expect(msg).not.toContain(reason)
  expect(msg).not.toMatch(/\b[A-Z]+(_[A-Z]+)+\b/)
  expect(msg).not.toMatch(/undefined|NaN|null|Infinity/)
}

describe('Property 2: Server name reasons always map to a friendly message', () => {
  it('reasonMessage is friendly for any reason', () => {
    fc.assert(
      fc.property(reasonArb, (reason) => {
        assertFriendly(reasonMessage(reason))
      }),
      { numRuns: 100 },
    )
  })

  it('describeGuestError is friendly for any code and extras', () => {
    fc.assert(
      fc.property(codeArb, reasonArb, retryArb, (code, reason, retry) => {
        assertFriendly(
          describeGuestError(code, { reason, retry_after_seconds: retry as number | null | undefined }),
        )
      }),
      { numRuns: 200 },
    )
  })

  it('describeGuestError tolerates missing extras', () => {
    fc.assert(
      fc.property(codeArb, (code) => {
        assertFriendly(describeGuestError(code))
      }),
      { numRuns: 100 },
    )
  })

  it('rate limit message contains a wait time for positive finite retry_after_seconds', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e-6, max: 1e6, noNaN: true }),
        (s) => {
          const msg = describeGuestError('RATE_LIMIT_EXCEEDED', { retry_after_seconds: s })
          assertFriendly(msg)
          expect(msg).toMatch(new RegExp(`wait ${Math.ceil(s)} seconds?`))
        },
      ),
      { numRuns: 100 },
    )
  })

  it('rate limit message stays generic for non-positive or non-finite values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(NaN, Infinity, -Infinity, 0, -1, -1e300, null, undefined),
        (s) => {
          const msg = describeGuestError('RATE_LIMIT_EXCEEDED', { retry_after_seconds: s as number | null | undefined })
          assertFriendly(msg)
          expect(msg).not.toMatch(/\d/)
        },
      ),
      { numRuns: 100 },
    )
  })
})
