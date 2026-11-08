import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { TYPEWRITER_RATE, visibleChars } from './typewriterMath'

describe('Property 8: Typewriter visibility', () => {
  /** **Validates: Requirements 5.7, 5.8** */
  it('stays an integer in [0, length], never decreases with time, and completes on skip or reduced', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 400 }),
        fc.integer({ min: 1, max: 200 }),
        fc.integer({ min: 0, max: 20000 }),
        fc.integer({ min: 0, max: 20000 }),
        fc.boolean(),
        fc.boolean(),
        (length, rate, t1, dt, skip, reduced) => {
          const a = visibleChars(length, rate, t1, skip, reduced)
          const b = visibleChars(length, rate, t1 + dt, skip, reduced)
          expect(Number.isInteger(a)).toBe(true)
          expect(a).toBeGreaterThanOrEqual(0)
          expect(a).toBeLessThanOrEqual(length)
          expect(b).toBeGreaterThanOrEqual(a)
          if (skip || reduced) expect(a).toBe(length)
        },
      ),
    )
  })

  it('reveals 45 characters per second', () => {
    expect(TYPEWRITER_RATE).toBe(45)
    expect(visibleChars(100, TYPEWRITER_RATE, 1000, false, false)).toBe(45)
    expect(visibleChars(100, TYPEWRITER_RATE, 0, false, false)).toBe(0)
  })
})
