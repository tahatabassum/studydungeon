import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import type { AnswerResult } from '@/types/api'
import { planCombat } from './combatPlan'

const resultArb: fc.Arbitrary<AnswerResult> = fc.record({
  correct: fc.boolean(),
  damage_dealt: fc.integer({ min: 0, max: 60 }),
  monster_hp_remaining: fc.integer({ min: 0, max: 60 }),
  player_hp_remaining: fc.integer({ min: 0, max: 100 }),
  score_delta: fc.integer({ min: 0, max: 100 }),
  xp_delta: fc.integer({ min: 0, max: 10 }),
  streak: fc.nat({ max: 20 }),
  source: fc.record({ page: fc.nat({ max: 50 }), chunk_id: fc.string() }),
  review_status: fc.constantFrom('due' as const, 'not_due' as const),
})

describe('planCombat', () => {
  // Feature: frontend-00-playable-slice, combat plan properties
  it('shake is bounded and absent under reduced motion', () => {
    fc.assert(
      fc.property(resultArb, fc.boolean(), (r, rm) => {
        const p = planCombat(r, rm)
        expect(p.shakeMs).toBeLessThanOrEqual(150)
        if (rm) {
          expect(p.shakeMs).toBe(0)
          for (const s of ['camera-shake', 'hit-flash', 'player-flash'] as const) {
            expect(p.steps).not.toContain(s)
          }
        }
      }),
      { numRuns: 100 },
    )
  })

  it('correct answers show monster hp and the damage text; wrong ones attack', () => {
    fc.assert(
      fc.property(resultArb, fc.boolean(), (r, rm) => {
        const p = planCombat(r, rm)
        if (r.correct) {
          expect(p.steps).toContain('monster-hp')
          expect(p.damageText).toBe(`-${r.damage_dealt}`)
        } else {
          expect(p.steps).not.toContain('projectile')
          expect(p.steps).toContain('monster-attack')
        }
      }),
      { numRuns: 100 },
    )
  })

  it('ends with defeat and gate-open when the monster has 0 HP', () => {
    fc.assert(
      fc.property(resultArb, fc.boolean(), (r, rm) => {
        const p = planCombat({ ...r, monster_hp_remaining: 0 }, rm)
        expect(p.steps.slice(-2)).toEqual(['monster-defeat', 'gate-open'])
        const q = planCombat({ ...r, monster_hp_remaining: Math.max(1, r.monster_hp_remaining) }, rm)
        expect(q.steps).not.toContain('gate-open')
      }),
      { numRuns: 100 },
    )
  })
})
