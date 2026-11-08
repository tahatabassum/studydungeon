import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { contrastRatio } from './contrast'

// Feature: frontend-06-halloween-visuals, Property 8: Contrast ratio is symmetric and bounded
// **Validates: Requirements 4.6**

const colorArb = fc.integer({ min: 0, max: 0xffffff })

describe('Property 8: Contrast ratio is symmetric and bounded', () => {
  it('is symmetric and within [1, 21]', () => {
    fc.assert(
      fc.property(colorArb, colorArb, (a, b) => {
        const r = contrastRatio(a, b)
        expect(r).toBe(contrastRatio(b, a))
        expect(r).toBeGreaterThanOrEqual(1)
        expect(r).toBeLessThanOrEqual(21 + 1e-9)
      }),
      { numRuns: 100 },
    )
  })

  it('is exactly 1 for identical colors', () => {
    fc.assert(
      fc.property(colorArb, (a) => {
        expect(contrastRatio(a, a)).toBe(1)
      }),
      { numRuns: 100 },
    )
  })

  it('black on white is 21:1', () => {
    expect(contrastRatio(0x000000, 0xffffff)).toBeCloseTo(21, 5)
  })
})
