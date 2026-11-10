import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { masteryBand } from '../learning/mastery'
import { classifyMastery, topicRows } from './mastery'
import { COUNT_UP_MS, countUpValue, rankRevealValue } from './useCountUp'

describe('Property 12: Mastery bands', () => {
  // Feature: frontend-07-premium-ux-leaderboard, Property 12: Mastery bands
  // **Validates: Requirements 10.3**
  it('is weak below 50, learning from 50 to 79, strong from 80, after clamping to 0..100', () => {
    fc.assert(
      fc.property(fc.double({ min: -50, max: 150, noNaN: true }), (value) => {
        const v = Math.min(100, Math.max(0, value))
        const expected = v < 50 ? 'weak' : v < 80 ? 'learning' : 'strong'
        expect(classifyMastery(value)).toBe(expected)
        // One set of boundaries: it is the frontend-08 band.
        expect(classifyMastery(value)).toBe(masteryBand(value))
      }),
      { numRuns: 200 },
    )
  })

  it('has the exact boundaries', () => {
    expect([0, 49, 49.9].map(classifyMastery)).toEqual(['weak', 'weak', 'weak'])
    expect([50, 79, 79.9].map(classifyMastery)).toEqual(['learning', 'learning', 'learning'])
    expect([80, 100, 140].map(classifyMastery)).toEqual(['strong', 'strong', 'strong'])
    expect(classifyMastery(-5)).toBe('weak')
  })

  it('reads topic rows from mastery_by_topic first, then the older topic_mastery', () => {
    expect(topicRows({ mastery_by_topic: [{ topic_id: 'a', title: 'A', mastery: 10 }], topic_mastery: [{ room_id: 'r', label: 'R', percent: 90 }] })).toEqual([
      { id: 'a', title: 'A', percent: 10 },
    ])
    expect(topicRows({ topic_mastery: [{ room_id: 'r', label: 'R', percent: 90 }] })).toEqual([{ id: 'r', title: 'R', percent: 90 }])
    expect(topicRows({})).toEqual([])
  })
})

describe('Property 13: Count-up is monotone and ends at the target', () => {
  // Feature: frontend-07-premium-ux-leaderboard, Property 13: Count-up is monotone and ends at the target
  // **Validates: Requirements 10.1, 10.9**
  it('is non-decreasing, never above the target, and the target at or after the duration', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.array(fc.integer({ min: 0, max: 3 * COUNT_UP_MS }), { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 100, max: 2000 }),
        (target, times, duration) => {
          const sorted = [...times].sort((a, b) => a - b)
          let prev = -1
          for (const t of sorted) {
            const v = countUpValue(target, t, duration)
            expect(v).toBeGreaterThanOrEqual(prev)
            expect(v).toBeLessThanOrEqual(target)
            if (t >= duration) expect(v).toBe(target)
            prev = v
          }
          expect(countUpValue(target, 0, duration)).toBe(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('shows the target at time 0 when Reduced_Motion is true', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), fc.integer({ min: 0, max: 5000 }), (target, t) => {
        expect(countUpValue(target, 0, COUNT_UP_MS, true)).toBe(target)
        expect(countUpValue(target, t, COUNT_UP_MS, true)).toBe(target)
      }),
      { numRuns: 100 },
    )
  })

  it('slides the rank reveal down to the final rank and never up', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), fc.integer({ min: 0, max: 30 }), (rank, extra) => {
        const from = rank + extra
        let prev = Number.POSITIVE_INFINITY
        for (let t = 0; t <= COUNT_UP_MS + 100; t += 50) {
          const v = rankRevealValue(rank, from, t)
          expect(v).toBeLessThanOrEqual(prev)
          expect(v).toBeGreaterThanOrEqual(rank)
          prev = v
        }
        expect(rankRevealValue(rank, from, COUNT_UP_MS)).toBe(rank)
        expect(rankRevealValue(rank, from, 0, COUNT_UP_MS, true)).toBe(rank)
      }),
      { numRuns: 100 },
    )
  })
})
