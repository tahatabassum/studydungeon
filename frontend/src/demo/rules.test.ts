import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  INITIAL_STATE,
  MAX_MONSTER_HP,
  MAX_PLAYER_HP,
  WEAPON_DAMAGE,
  WRONG_ANSWER_DAMAGE,
  applyAnswer,
  type RulesState,
} from './rules'

const stateArb: fc.Arbitrary<RulesState> = fc.record({
  playerHp: fc.integer({ min: 0, max: 100 }),
  monsterHp: fc.integer({ min: 0, max: 60 }),
  streak: fc.integer({ min: 0, max: 50 }),
})

const runs = { numRuns: 100 }

describe('Demo_Rules unit tests', () => {
  it('has the agreed starting values and constants', () => {
    expect(INITIAL_STATE).toEqual({ playerHp: 100, monsterHp: 60, streak: 0 })
    expect(MAX_PLAYER_HP).toBe(100)
    expect(MAX_MONSTER_HP).toBe(60)
    expect(WEAPON_DAMAGE).toBe(20)
    expect(WRONG_ANSWER_DAMAGE).toBe(10)
  })

  it('does not mutate its input state', () => {
    const state: RulesState = { playerHp: 50, monsterHp: 40, streak: 3 }
    const copy = { ...state }
    applyAnswer(state, true)
    applyAnswer(state, false)
    expect(state).toEqual(copy)
    const frozen = Object.freeze({ ...INITIAL_STATE })
    expect(() => applyAnswer(frozen, true)).not.toThrow()
    expect(INITIAL_STATE).toEqual({ playerHp: 100, monsterHp: 60, streak: 0 })
  })
})

describe('Demo_Rules properties', () => {
  // Feature: frontend-00-playable-slice, Property 1: Correct answer result
  // **Validates: Requirements 5.2, 5.5, 5.8**
  it('Property 1: Correct answer result', () => {
    fc.assert(
      fc.property(stateArb, (s) => {
        const { next, result } = applyAnswer(s, true)
        const dmg = Math.min(20, s.monsterHp)
        expect(result.correct).toBe(true)
        expect(result.damage_dealt).toBe(dmg)
        expect(result.score_delta).toBe(100)
        expect(result.xp_delta).toBe(10)
        expect(result.review_status).toBe('not_due')
        expect(result.streak).toBe(s.streak + 1)
        expect(next.streak).toBe(s.streak + 1)
        expect(next.playerHp).toBe(s.playerHp)
        expect(next.monsterHp).toBe(s.monsterHp - dmg)
        expect(result.player_hp_remaining).toBe(s.playerHp)
        expect(result.monster_hp_remaining).toBe(s.monsterHp - dmg)
      }),
      runs,
    )
  })

  // Feature: frontend-00-playable-slice, Property 2: Wrong answer result
  // **Validates: Requirements 5.3, 5.6, 5.8**
  it('Property 2: Wrong answer result', () => {
    fc.assert(
      fc.property(stateArb, (s) => {
        const { next, result } = applyAnswer(s, false)
        const loss = Math.min(10, s.playerHp)
        expect(result.correct).toBe(false)
        expect(result.damage_dealt).toBe(0)
        expect(result.score_delta).toBe(0)
        expect(result.xp_delta).toBe(0)
        expect(result.review_status).toBe('due')
        expect(result.streak).toBe(0)
        expect(next.streak).toBe(0)
        expect(next.monsterHp).toBe(s.monsterHp)
        expect(next.playerHp).toBe(s.playerHp - loss)
        expect(result.monster_hp_remaining).toBe(s.monsterHp)
        expect(result.player_hp_remaining).toBe(s.playerHp - loss)
      }),
      runs,
    )
  })

  // Feature: frontend-00-playable-slice, Property 3: Rules state invariants over sequences
  // **Validates: Requirements 5.4, 15.1**
  it('Property 3: Rules state invariants over sequences', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { maxLength: 60 }), (answers) => {
        let state: RulesState = INITIAL_STATE
        for (const a of answers) {
          const { next, result } = applyAnswer(state, a)
          expect(next.playerHp).toBeGreaterThanOrEqual(0)
          expect(next.playerHp).toBeLessThanOrEqual(100)
          expect(next.monsterHp).toBeGreaterThanOrEqual(0)
          expect(next.monsterHp).toBeLessThanOrEqual(60)
          expect(next.monsterHp).toBeLessThanOrEqual(state.monsterHp)
          expect(result.damage_dealt).toBeGreaterThanOrEqual(0)
          state = next
        }
      }),
      runs,
    )
  })

  // Feature: frontend-00-playable-slice, Property 4: Rules determinism
  // **Validates: Requirements 5.7**
  it('Property 4: Rules determinism', () => {
    const play = (answers: boolean[]) => {
      let state: RulesState = INITIAL_STATE
      const results = answers.map((a) => {
        const out = applyAnswer(state, a)
        state = out.next
        return out.result
      })
      return { results, state }
    }
    fc.assert(
      fc.property(fc.array(fc.boolean(), { maxLength: 60 }), (answers) => {
        expect(play(answers)).toEqual(play(answers))
      }),
      runs,
    )
  })
})
