import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { QuotaReason, UploadQuota } from '../types/api'
import { describeLimitError } from './limitErrors'
import { quotaView } from './quotaView'

const reasons: QuotaReason[] = ['player_daily_limit', 'ip_daily_limit', 'stored_limit', 'global_daily_limit', 'ai_unavailable']
const nat = fc.integer({ min: 0, max: 50 })

const quotaArb: fc.Arbitrary<UploadQuota> = fc.record({
  can_upload: fc.boolean(),
  reason: fc.option(fc.constantFrom(...reasons), { nil: null }),
  player: fc.record({ is_guest: fc.boolean(), used_today: nat, limit_today: nat, stored: nat, stored_limit: nat }),
  global: fc.option(fc.record({ available: fc.boolean() }), { nil: undefined }),
}).map(({ global, ...rest }) => ({ ...rest, ...(global ? { global } : {}) }))

describe('Property 16: The quota view never offers a blocked upload', () => {
  // Feature: frontend-10-live-players, Property 16: The quota view never offers a blocked upload
  // **Validates: Requirements 15.3, 15.4**
  it('is allowed only when the Backend says so and nothing is used up; remaining is never negative', () => {
    fc.assert(
      fc.property(quotaArb, (q) => {
        const v = quotaView(q)
        expect(v.remaining).toBeGreaterThanOrEqual(0)
        expect(v.remaining).toBe(Math.max(0, q.player.limit_today - q.player.used_today))
        if (!q.can_upload || q.reason !== null || v.remaining === 0 || q.player.stored >= q.player.stored_limit || q.global?.available === false) {
          expect(v.allowed).toBe(false)
          expect(v.reason).not.toBeNull()
          expect(v.offerPacks).toBe(true)
        } else {
          expect(v.allowed).toBe(true)
          expect(v.reason).toBeNull()
          expect(v.offerPacks).toBe(false)
        }
        expect(v.line.length).toBeGreaterThan(0)
        // An account is offered only to a blocked guest.
        if (v.offerAccount) expect(q.player.is_guest && !v.allowed).toBe(true)
      }),
      { numRuns: 100 },
    )
  })
})

describe('Property 17: Limit errors state both numbers', () => {
  // Feature: frontend-10-live-players, Property 17: Limit errors state both numbers
  // **Validates: Requirements 16.6**
  it('names the limit and the found count for pages, slides and characters', () => {
    fc.assert(
      fc.property(fc.constantFrom('TOO_MANY_PAGES', 'TOO_MANY_SLIDES', 'TOO_MUCH_TEXT'), fc.integer({ min: 1, max: 500000 }), fc.integer({ min: 1, max: 500000 }), (code, limit, found) => {
        const text = describeLimitError(code, { limit, found })
        expect(text).not.toBeNull()
        expect(text).toContain(limit.toLocaleString('en-US'))
        expect(text).toContain(found.toLocaleString('en-US'))
      }),
      { numRuns: 100 },
    )
  })

  it('returns null for any other code', () => {
    fc.assert(
      fc.property(fc.string().filter((s) => !['TOO_MANY_PAGES', 'TOO_MANY_SLIDES', 'TOO_MUCH_TEXT'].includes(s)), (code) => {
        expect(describeLimitError(code, { limit: 3, found: 4 })).toBeNull()
      }),
      { numRuns: 100 },
    )
  })
})
