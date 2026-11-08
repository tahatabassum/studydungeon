import { describe, expect, it } from 'vitest'
import { feedbackPlan } from './feedback'
import { MIST_BLOBS, TRANSITION_MAX_MS, transitionPlan } from './transition'

describe('feedbackPlan', () => {
  it('correct answers give a green wisp burst and no tint', () => {
    const p = feedbackPlan(true, false)
    expect(p.kind).toBe('wisp')
    expect(p.wisps).toBeGreaterThan(0)
    expect(p.tintAlpha).toBe(0)
  })

  it('wrong answers give a single purple-red flash under normal motion', () => {
    const p = feedbackPlan(false, false)
    expect(p.kind).toBe('curse')
    expect(p.flash).toBe(true)
    expect(p.tintAlpha).toBeGreaterThan(0)
  })

  it('wrong answers use a static fading tint under reduced motion', () => {
    const p = feedbackPlan(false, true)
    expect(p.flash).toBe(false)
    expect(p.animated).toBe(false)
    expect(p.tintAlpha).toBeLessThan(feedbackPlan(false, false).tintAlpha)
    expect(p.fadeMs).toBeGreaterThan(0)
  })

  it('correct wisps are still under reduced motion', () => {
    expect(feedbackPlan(true, true).animated).toBe(false)
  })
})

describe('transitionPlan', () => {
  it('is off under reduced motion', () => {
    expect(transitionPlan(true)).toBeNull()
  })

  it('ends within 600 ms including every stagger', () => {
    const p = transitionPlan(false)
    expect(p).not.toBeNull()
    if (!p) return
    expect(p.totalMs).toBeLessThanOrEqual(TRANSITION_MAX_MS)
    expect(p.blobs).toBe(MIST_BLOBS)
    for (let i = 0; i < p.blobs; i++) {
      expect(p.delayMs(i) + p.sweepMs).toBeLessThanOrEqual(TRANSITION_MAX_MS)
    }
  })
})
