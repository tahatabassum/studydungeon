import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { FLASH_ALPHA_MAX, HIT_SHAKE_INTENSITY, HIT_SHAKE_MS, HIT_STOP_MS, planHit } from './effectPlan'
import { COMBO_TIER_STARTS, comboTier } from './comboTier'

describe('planHit', () => {
  // Feature: frontend-08-campaign-learning-loop, Property 16: Effect plans respect reduced motion
  // **Validates: Requirements 12.1, 12.3**
  it('Property 16: reduced motion is all zeros; otherwise hit-stop and shake only for critical hits and boss kills', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), (critical, bossKill, reducedMotion) => {
        const p = planHit({ critical, bossKill, reducedMotion })
        if (reducedMotion) {
          expect(p.hitStopMs).toBe(0)
          expect(p.shakeMs).toBe(0)
          expect(p.shakeIntensity).toBe(0)
          expect(p.flash).toBe(false)
          expect(p.popScale).toBe(1)
          expect(p.knockbackPx).toBe(0)
        } else if (critical || bossKill) {
          expect(p.hitStopMs).toBe(HIT_STOP_MS)
          expect(p.shakeMs).toBe(HIT_SHAKE_MS)
          expect(p.shakeIntensity).toBe(HIT_SHAKE_INTENSITY)
        } else {
          expect(p.hitStopMs).toBe(0)
          expect(p.shakeMs).toBe(0)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('uses the D22 numbers and a safe flash level', () => {
    expect(HIT_STOP_MS).toBe(60)
    expect(HIT_SHAKE_MS).toBe(140)
    expect(HIT_SHAKE_INTENSITY).toBe(0.004)
    expect(FLASH_ALPHA_MAX).toBeLessThanOrEqual(0.35)
  })
})

describe('comboTier', () => {
  // Feature: frontend-08-campaign-learning-loop, Property 14: Combo tier is monotone with fixed boundaries
  // **Validates: Requirements 11.1, 11.2**
  it('Property 14: non-decreasing, 0 below 3, and steps exactly at 3, 5, 8 and 12', () => {
    const starts: readonly number[] = COMBO_TIER_STARTS
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), (n) => {
        expect(comboTier(n + 1)).toBeGreaterThanOrEqual(comboTier(n))
        if (n < 3) expect(comboTier(n)).toBe(0)
        expect(comboTier(n + 1) - comboTier(n)).toBe(starts.includes(n + 1) ? 1 : 0)
      }),
      { numRuns: 200 },
    )
  })

  it('maps the boundaries to the named tiers and ignores bad input', () => {
    expect([2, 3, 4, 5, 7, 8, 11, 12, 50].map(comboTier)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4])
    expect(comboTier(Number.NaN)).toBe(0)
    expect(comboTier(-4)).toBe(0)
  })
})
