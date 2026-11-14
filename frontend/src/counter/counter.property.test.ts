import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { shouldRefetch } from './cache'
import { countUpValue } from './countUp'
import { explorerCountText, formatExplorerLine } from './format'

describe('counter properties', () => {
  // Feature: frontend-10-live-players, Property 13: Counter cache refetches only after expiry
  it('Property 13: shouldRefetch is true exactly when empty or expired, and monotone in time', () => {
    // **Validates: Requirements 14.1, 14.4**
    fc.assert(
      fc.property(fc.nat(1e9), fc.nat(1e7), fc.nat(1e7), fc.nat(1e7), (fetchedAt, ttl, d1, d2) => {
        const t1 = fetchedAt + d1
        const t2 = t1 + d2
        expect(shouldRefetch(null, t1, ttl)).toBe(true)
        expect(shouldRefetch(fetchedAt, t1, ttl)).toBe(d1 >= ttl)
        if (shouldRefetch(fetchedAt, t1, ttl)) expect(shouldRefetch(fetchedAt, t2, ttl)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: frontend-10-live-players, Property 14: The counter line shows the exact received number or nothing
  it('Property 14: the line is exact or null; singular only for 1', () => {
    // **Validates: Requirements 14.2, 14.3, 14.5, 14.8, 14.12**
    fc.assert(
      fc.property(fc.oneof(fc.integer({ min: -50, max: 50 }), fc.integer({ min: 0, max: 2_000_000_000 }), fc.double({ noNaN: false })), (n) => {
        const line = formatExplorerLine(n)
        if (!Number.isInteger(n) || n < 1) {
          expect(line).toBeNull()
          return
        }
        if (n < 10) {
          expect(line).toBe('Be among the first explorers')
          expect(/\d/.test(line as string)).toBe(false)
          return
        }
        expect(line).toBe(`${new Intl.NumberFormat('en-US').format(n)} explorers have braved the dungeon`)
        expect(Number((line as string).match(/[\d,]+/)![0].replace(/,/g, ''))).toBe(n)
      }),
      { numRuns: 100 },
    )
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }), (n) => {
        expect(/\b1 explorer$/.test(explorerCountText(n)) && n !== 1).toBe(false)
        expect(explorerCountText(n).endsWith(' explorer')).toBe(n === 1)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: frontend-10-live-players, Property 15: Count-up is bounded, monotone and exact at the end
  it('Property 15: countUpValue is bounded, monotone and exact at the end', () => {
    // **Validates: Requirements 14.6, 14.7**
    fc.assert(
      fc.property(fc.nat(1e9), fc.integer({ min: 1, max: 800 }), fc.nat(2000), fc.nat(2000), fc.boolean(), (target, dur, a, b, reduced) => {
        const [t1, t2] = a <= b ? [a, b] : [b, a]
        const v1 = countUpValue(t1, dur, target, reduced)
        const v2 = countUpValue(t2, dur, target, reduced)
        expect(Number.isInteger(v1) && v1 >= 0 && v1 <= target).toBe(true)
        expect(v2).toBeGreaterThanOrEqual(v1)
        if (t2 >= dur || reduced) expect(v2).toBe(target)
        if (reduced) expect(v1).toBe(target)
      }),
      { numRuns: 100 },
    )
  })
})
