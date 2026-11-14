import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { pointsText } from './pointsText'

const KNOWN = ['first_correct', 'repeat_correct', 'retry', 'practice', 'room_clear', 'boss_clear', 'pack_complete'] as const
const reasonArb = fc.oneof(fc.constantFrom(...KNOWN), fc.string(), fc.constant(null), fc.constant(undefined))

// Feature: frontend-10-live-players, Property 7: Points text is total and hides what it cannot explain
// **Validates: Requirements 10.3, 10.4, 10.5**
describe('Property 7: Points text is total and hides what it cannot explain', () => {
  it('returns null or a non-empty string that contains the amount, never throws', () => {
    fc.assert(
      fc.property(fc.nat({ max: 1_000_000 }), reasonArb, (n, reason) => {
        const out = pointsText(n, reason)
        if (n === 0) {
          expect(out).toBeNull()
          return
        }
        expect(typeof out).toBe('string')
        expect(out!.length).toBeGreaterThan(0)
        expect(out).toContain(`+${n} `)
      }),
      { numRuns: 100 },
    )
  })

  it('returns null for an absent or unusable amount', () => {
    fc.assert(
      fc.property(fc.constantFrom(undefined, null, Number.NaN, Infinity, -Infinity, -1, -50), reasonArb, (n, reason) => {
        expect(pointsText(n, reason)).toBeNull()
      }),
      { numRuns: 100 },
    )
  })

  it('never writes reason wording for an unknown reason', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.string().filter((s) => !(KNOWN as readonly string[]).includes(s)),
        (n, reason) => {
          expect(pointsText(n, reason)).toBe(`+${n} ${n === 1 ? 'point' : 'points'}`)
        },
      ),
      { numRuns: 100 },
    )
  })
})
