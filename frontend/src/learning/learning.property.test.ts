import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { updateMastery } from './masteryStore'
import { masteryBand } from './mastery'
import { RANK_VALUE, firstTryAccuracy, rankFor } from './rank'

describe('mastery', () => {
  // Feature: frontend-08-campaign-learning-loop, Property 6: Mastery stays in range
  // **Validates: Requirements 3.7**
  it('Property 6: every update is an integer in 0..100, correct never lowers it, wrong never raises it', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), fc.array(fc.boolean(), { maxLength: 60 }), (start, answers) => {
        let m = start
        for (const correct of answers) {
          const next = updateMastery(m, correct)
          expect(Number.isInteger(next)).toBe(true)
          expect(next).toBeGreaterThanOrEqual(0)
          expect(next).toBeLessThanOrEqual(100)
          if (correct) expect(next).toBeGreaterThanOrEqual(m)
          else expect(next).toBeLessThanOrEqual(m)
          m = next
        }
      }),
      { numRuns: 100 },
    )
  })

  it('a topic with no attempts starts at 50', () => {
    expect(updateMastery(undefined, true)).toBe(65)
    expect(updateMastery(undefined, false)).toBe(35)
  })

  // Feature: frontend-08-campaign-learning-loop, Property 7: Mastery bands match their boundaries
  // **Validates: Requirements 10.2**
  it('Property 7: bands are Weak below 50, Learning 50 to 79, Strong from 80, and never decrease', () => {
    const order = { weak: 0, learning: 1, strong: 2 }
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (v) => {
        const band = masteryBand(v)
        expect(band).toBe(v < 50 ? 'weak' : v < 80 ? 'learning' : 'strong')
        if (v < 100) expect(order[masteryBand(v + 1)]).toBeGreaterThanOrEqual(order[band])
      }),
      { numRuns: 100 },
    )
    expect([masteryBand(49), masteryBand(50), masteryBand(79), masteryBand(80)]).toEqual([
      'weak',
      'learning',
      'learning',
      'strong',
    ])
  })
})

describe('floor rank', () => {
  // Feature: frontend-08-campaign-learning-loop, Property 8: Floor rank is monotone in accuracy
  // **Validates: Requirements 3.8, 11.3**
  it('Property 8: a higher accuracy never gives a worse rank (equal retries)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: 0, max: 5 }),
        (x, y, retries) => {
          const [lo, hi] = x <= y ? [x, y] : [y, x]
          expect(RANK_VALUE[rankFor(hi, retries)]).toBeGreaterThanOrEqual(RANK_VALUE[rankFor(lo, retries)])
        },
      ),
      { numRuns: 100 },
    )
  })

  it('boundaries 0.90, 0.80 and 0.60 map to S, A and B; a retry blocks S', () => {
    expect(rankFor(0.9)).toBe('S')
    expect(rankFor(0.8999)).toBe('A')
    expect(rankFor(0.8)).toBe('A')
    expect(rankFor(0.6)).toBe('B')
    expect(rankFor(0.5999)).toBe('C')
    expect(rankFor(1, 1)).toBe('A')
    expect(firstTryAccuracy(7, 10)).toBe(0.7)
    expect(firstTryAccuracy(0, 0)).toBe(0)
  })
})
