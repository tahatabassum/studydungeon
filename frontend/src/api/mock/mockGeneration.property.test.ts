import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createGenerationSim, phaseAt, type GenerationPhase } from './mockGeneration'

const ORDER: Record<GenerationPhase, number> = { queued: 0, generating: 1, ready: 2, failed: 2 }

describe('mock generation status', () => {
  // Feature: frontend-08-campaign-learning-loop, Property 10: Generation status only moves forward
  // **Validates: Requirements 3.10**
  it('Property 10: queued, generating, then ready or failed; never backwards, terminal states stay put', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 30 }),
        fc.array(fc.integer({ min: 0, max: 400_000 }), { minLength: 2, maxLength: 20 }),
        fc.option(fc.integer({ min: 0, max: 30 }), { nil: null }),
        (index, times, failIndex) => {
          const sorted = [...times].sort((a, b) => a - b)
          let prev: GenerationPhase = 'queued'
          for (const t of sorted) {
            const phase = phaseAt(index, t, { failIndex })
            expect(ORDER[phase]).toBeGreaterThanOrEqual(ORDER[prev])
            if (prev === 'ready' || prev === 'failed') expect(phase).toBe(prev)
            prev = phase
          }
          expect(['ready', 'failed']).toContain(phaseAt(index, 10_000_000, { failIndex }))
        },
      ),
      { numRuns: 100 },
    )
  })

  it('a failed floor can be retried and then becomes ready; a ready floor cannot', () => {
    const sim = createGenerationSim(3, { stepMs: 1000, failIndex: 1 })
    expect(sim.statuses(10_000)).toEqual(['ready', 'failed', 'ready'])
    expect(sim.retry(0, 10_000)).toBe(false)
    expect(sim.retry(1, 10_000)).toBe(true)
    expect(sim.statuses(10_500)[1]).toBe('generating')
    expect(sim.statuses(11_500)[1]).toBe('ready')
  })

  it('floors are summoned one at a time', () => {
    const sim = createGenerationSim(3, { stepMs: 1000 })
    expect(sim.statuses(0)).toEqual(['generating', 'locked', 'locked'])
    expect(sim.statuses(1500)).toEqual(['ready', 'generating', 'locked'])
  })
})
