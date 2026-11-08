import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { flicker } from './flicker'

// Feature: frontend-06-halloween-visuals, Property 3: Flicker stays within bounds and is deterministic
// Feature: frontend-06-halloween-visuals, Property 4: Flicker is constant under reduced motion
// **Validates: Requirements 4.3, 8.1, 8.2, 8.3**

const boundsArb = fc
  .tuple(fc.double({ min: 0, max: 2, noNaN: true }), fc.double({ min: 0, max: 2, noNaN: true }))
  .map(([a, b]) => ({ min: Math.min(a, b), max: Math.max(a, b) }))
const timeArb = fc.double({ min: 0, max: 1e7, noNaN: true })
const seedArb = fc.integer({ min: 0, max: 100000 })

describe('Property 3: Flicker stays within bounds and is deterministic', () => {
  it('returns a value within [min, max] and is deterministic', () => {
    fc.assert(
      fc.property(timeArb, seedArb, boundsArb, (t, seed, { min, max }) => {
        const v = flicker(t, seed, min, max, false)
        expect(v).toBeGreaterThanOrEqual(min)
        expect(v).toBeLessThanOrEqual(max)
        expect(flicker(t, seed, min, max, false)).toBe(v)
      }),
      { numRuns: 100 },
    )
  })
})

describe('Property 4: Flicker is constant under reduced motion', () => {
  it('returns the midpoint for every time and seed', () => {
    fc.assert(
      fc.property(timeArb, seedArb, boundsArb, (t, seed, { min, max }) => {
        expect(flicker(t, seed, min, max, true)).toBe((min + max) / 2)
      }),
      { numRuns: 100 },
    )
  })
})
