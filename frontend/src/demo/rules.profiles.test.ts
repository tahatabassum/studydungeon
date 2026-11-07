import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { BOSS_PROFILE, ROOM_PROFILE, applyAnswer, type RulesState } from './rules'

const stateArb: fc.Arbitrary<RulesState> = fc.record({
  playerHp: fc.integer({ min: 0, max: 100 }),
  monsterHp: fc.integer({ min: 0, max: 120 }),
  streak: fc.integer({ min: 0, max: 50 }),
})

const profileArb = fc.constantFrom(ROOM_PROFILE, BOSS_PROFILE)

describe('Demo_Rules profiles', () => {
  it('has the agreed constant values', () => {
    expect(ROOM_PROFILE).toEqual({ weaponDamage: 20, wrongAnswerDamage: 10 })
    expect(BOSS_PROFILE).toEqual({ weaponDamage: 20, wrongAnswerDamage: 12 })
  })

  // Feature: frontend-03-phaser-core, Property 5: Room and boss damage values
  // **Validates: Requirements 6.6, 6.7, 6.8, 6.9**
  it('Property 5: Room and boss damage values', () => {
    fc.assert(
      fc.property(stateArb, profileArb, (state, profile) => {
        const correct = applyAnswer(state, true, profile)
        expect(correct.result.damage_dealt).toBe(Math.min(20, state.monsterHp))
        expect(correct.next.monsterHp).toBe(state.monsterHp - Math.min(20, state.monsterHp))
        expect(correct.next.playerHp).toBe(state.playerHp)

        const expectedWrong = profile === BOSS_PROFILE ? 12 : 10
        const wrong = applyAnswer(state, false, profile)
        expect(wrong.next.playerHp).toBe(state.playerHp - Math.min(expectedWrong, state.playerHp))
        expect(wrong.next.monsterHp).toBe(state.monsterHp)
        expect(wrong.result.damage_dealt).toBe(0)
      }),
      { numRuns: 200 },
    )
  })

  it('defaults to the room profile', () => {
    fc.assert(
      fc.property(stateArb, fc.boolean(), (state, correct) => {
        expect(applyAnswer(state, correct)).toEqual(applyAnswer(state, correct, ROOM_PROFILE))
      }),
      { numRuns: 100 },
    )
  })
})
