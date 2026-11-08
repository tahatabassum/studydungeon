import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { bossPhase } from './bossPhase'
import { LIGHTNING_PEAK_ALPHA, LIGHTNING_SPACING_MS, nextLightningAt } from './lightning'
import { lightningAlpha } from './systems/pieceMotion'

// Feature: frontend-07-premium-ux-leaderboard, Property 3: Boss phase depends only on HP thresholds
describe('Property 3: Boss phase depends only on HP thresholds', () => {
  it('matches the thresholds for any maxHp above 0 and any integer hp', () => {
    /** Validates: Requirements 8.1, 8.2 */
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: -50, max: 1200 }), (maxHp, hp) => {
        const phase = bossPhase(hp, maxHp)
        if (hp <= 0) expect(phase).toBe('defeated')
        else if (hp / maxHp < 0.5) expect(phase).toBe('enraged')
        else expect(phase).toBe('normal')
      }),
      { numRuns: 100 },
    )
  })

  it('lowering hp never moves the phase from enraged back to normal', () => {
    /** Validates: Requirements 8.2 */
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), fc.integer({ min: 0, max: 500 }), fc.integer({ min: 0, max: 500 }), (maxHp, a, b) => {
        const hi = Math.max(a, b)
        const lo = Math.min(a, b)
        if (bossPhase(hi, maxHp) === 'enraged') expect(bossPhase(lo, maxHp)).not.toBe('normal')
      }),
      { numRuns: 100 },
    )
  })

  it('treats a non-positive maxHp as normal', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 0 }), fc.integer({ min: -100, max: 100 }), (maxHp, hp) => {
        expect(bossPhase(hp, maxHp)).toBe('normal')
      }),
      { numRuns: 100 },
    )
  })

  it('boss HP 120: 60 is normal, 59 is enraged, 0 is defeated', () => {
    expect(bossPhase(60, 120)).toBe('normal')
    expect(bossPhase(59, 120)).toBe('enraged')
    expect(bossPhase(0, 120)).toBe('defeated')
  })
})

// Feature: frontend-07-premium-ux-leaderboard, Property 4: Lightning schedule respects spacing and reduced motion
describe('Property 4: Lightning schedule respects spacing and reduced motion', () => {
  /** Runs the scheduler over timestamps the way the scene does and returns the granted flash times. */
  function grants(times: number[], reduced: boolean, jitters: number[]): number[] {
    const out: number[] = []
    let j = 0
    let next = nextLightningAt(times[0] ?? 0, times[0] ?? 0, reduced, jitters[j++ % jitters.length])
    for (const t of times) {
      if (t >= next) {
        out.push(t)
        next = nextLightningAt(t, t, reduced, jitters[j++ % jitters.length])
      }
    }
    return out
  }

  const timesArb = fc
    .array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 120 })
    .map((steps) => {
      let t = 0
      return steps.map((s) => (t += s))
    })
  const jitterArb = fc.array(fc.integer({ min: 0, max: 12000 }), { minLength: 1, maxLength: 5 })

  it('grants flashes at least 8000 ms apart', () => {
    /** Validates: Requirements 8.6 */
    fc.assert(
      fc.property(timesArb, jitterArb, (times, jitters) => {
        const g = grants(times, false, jitters)
        for (let i = 1; i < g.length; i++) expect(g[i] - g[i - 1]).toBeGreaterThanOrEqual(LIGHTNING_SPACING_MS)
      }),
      { numRuns: 100 },
    )
  })

  it('never grants a flash under Reduced_Motion', () => {
    /** Validates: Requirements 8.5 */
    fc.assert(
      fc.property(timesArb, jitterArb, (times, jitters) => {
        expect(grants(times, true, jitters)).toEqual([])
      }),
      { numRuns: 100 },
    )
  })

  it('never exceeds a peak overlay alpha of 0.25', () => {
    /** Validates: Requirements 8.6 */
    fc.assert(
      fc.property(fc.double({ min: -100, max: 1000, noNaN: true }), (since) => {
        const a = lightningAlpha(since)
        expect(a).toBeGreaterThanOrEqual(0)
        expect(a).toBeLessThanOrEqual(LIGHTNING_PEAK_ALPHA)
      }),
      { numRuns: 200 },
    )
  })

  it('next flash is never earlier than last + 8000', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e6 }), fc.integer({ min: 0, max: 1e6 }), fc.integer({ min: 0, max: 20000 }), (now, last, jitter) => {
        expect(nextLightningAt(now, last, false, jitter)).toBeGreaterThanOrEqual(last + LIGHTNING_SPACING_MS)
      }),
      { numRuns: 100 },
    )
  })
})
