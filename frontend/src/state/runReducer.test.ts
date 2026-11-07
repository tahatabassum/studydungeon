import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { applyAnswer, INITIAL_STATE, type RulesState } from '@/demo/rules'
import type { AnswerResult, Run } from '@/types/api'
import { initialRunState, runReducer, type RunAction, type RunState } from './runReducer'

const runs = { numRuns: 100 }

const run: Run = { id: 'r1', dungeon_id: 'd1', player_hp: 100, monster_hp: 60 }

const reduce = (s: RunState, ...actions: RunAction[]): RunState => actions.reduce(runReducer, s)

const started = (): RunState => runReducer(initialRunState, { type: 'run-started', run })

const mkResult = (o: Partial<AnswerResult> = {}): AnswerResult => ({
  correct: true,
  damage_dealt: 0,
  monster_hp_remaining: 60,
  player_hp_remaining: 100,
  score_delta: 0,
  xp_delta: 0,
  streak: 0,
  source: { page: 1, chunk_id: 'c1' },
  review_status: 'not_due',
  ...o,
})

/** Drive one result through encounter -> received -> settled. */
const settle = (s: RunState, result: AnswerResult): RunState =>
  reduce(s, { type: 'encounter-started' }, { type: 'result-received', result }, { type: 'result-settled' })

const resultArb: fc.Arbitrary<AnswerResult> = fc.record({
  correct: fc.boolean(),
  damage_dealt: fc.integer({ min: 0, max: 60 }),
  monster_hp_remaining: fc.integer({ min: 0, max: 60 }),
  player_hp_remaining: fc.integer({ min: 0, max: 100 }),
  score_delta: fc.integer({ min: 0, max: 1000 }),
  xp_delta: fc.integer({ min: 0, max: 100 }),
  streak: fc.integer({ min: 0, max: 50 }),
  source: fc.record({ page: fc.integer({ min: 1, max: 500 }), chunk_id: fc.string() }),
  review_status: fc.constantFrom('due' as const, 'not_due' as const),
})

describe('runReducer properties', () => {
  it('Feature: frontend-00-playable-slice, Property 7: Reducer copies authoritative values', () => {
    // **Validates: Requirements 10.6, 12.2**
    fc.assert(
      fc.property(
        resultArb,
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        (result, xp, score) => {
          const before = reduce({ ...started(), xp, score }, { type: 'encounter-started' })
          expect(before.phase).toBe('encounter')
          const after = runReducer(before, { type: 'result-received', result })
          expect(after.playerHp).toBe(result.player_hp_remaining)
          expect(after.monsterHp).toBe(result.monster_hp_remaining)
          expect(after.streak).toBe(result.streak)
          expect(after.xp).toBe(xp + result.xp_delta)
          expect(after.score).toBe(score + result.score_delta)
          expect(after.phase).toBe('resolving')
        },
      ),
      runs,
    )
  })

  it('Feature: frontend-00-playable-slice, Property 8: Reducer sequence invariants and terminal phases', () => {
    // **Validates: Requirements 12.1, 12.4, 15.5**
    fc.assert(
      fc.property(fc.array(fc.boolean(), { maxLength: 30 }), (answers) => {
        let rules: RulesState = INITIAL_STATE
        let state = started()
        for (const correct of answers) {
          const { next, result } = applyAnswer(rules, correct)
          rules = next
          const prevMonster = state.monsterHp
          const full: AnswerResult = { ...result, source: { page: 1, chunk_id: 'c' } }
          state = reduce(state, { type: 'encounter-started' }, { type: 'result-received', result: full })
          expect(state.monsterHp).toBeLessThanOrEqual(prevMonster)
          state = runReducer(state, { type: 'result-settled' })
          expect(state.playerHp).toBeGreaterThanOrEqual(0)
          expect(state.playerHp).toBeLessThanOrEqual(100)
          expect(state.monsterHp).toBeGreaterThanOrEqual(0)
          expect(state.monsterHp).toBeLessThanOrEqual(60)
          expect(state.phase === 'defeated').toBe(state.playerHp === 0)
          expect(state.phase === 'cleared').toBe(state.playerHp > 0 && state.monsterHp === 0)
          if (state.playerHp > 0 && state.monsterHp > 0) expect(state.phase).toBe('exploring')
          if (state.phase === 'defeated' || state.phase === 'cleared') break
        }
      }),
      runs,
    )
  })
})

describe('runReducer HP boundaries', () => {
  it('player HP exactly 0 -> defeated', () => {
    expect(settle(started(), mkResult({ player_hp_remaining: 0, monster_hp_remaining: 40 })).phase).toBe('defeated')
  })

  it('monster HP exactly 0 -> cleared', () => {
    expect(settle(started(), mkResult({ player_hp_remaining: 50, monster_hp_remaining: 0 })).phase).toBe('cleared')
  })

  it('player 0 takes precedence over monster 0', () => {
    expect(settle(started(), mkResult({ player_hp_remaining: 0, monster_hp_remaining: 0 })).phase).toBe('defeated')
  })

  it('10 consecutive wrong answers from 100 -> defeated at exactly 0', () => {
    let rules: RulesState = INITIAL_STATE
    let state = started()
    for (let i = 0; i < 10; i++) {
      const { next, result } = applyAnswer(rules, false)
      rules = next
      state = settle(state, mkResult(result))
      if (i < 9) expect(state.phase).toBe('exploring')
    }
    expect(state.playerHp).toBe(0)
    expect(state.phase).toBe('defeated')
  })

  it('3 correct answers (60 -> 0) -> cleared', () => {
    let rules: RulesState = INITIAL_STATE
    let state = started()
    for (let i = 0; i < 3; i++) {
      const { next, result } = applyAnswer(rules, true)
      rules = next
      state = settle(state, mkResult(result))
    }
    expect(state.monsterHp).toBe(0)
    expect(state.phase).toBe('cleared')
  })

  it('result leaving HP at 1 -> exploring', () => {
    expect(settle(started(), mkResult({ player_hp_remaining: 1, monster_hp_remaining: 1 })).phase).toBe('exploring')
  })
})

describe('runReducer transition guards', () => {
  it('ignores result-received in exploring', () => {
    const s = started()
    expect(runReducer(s, { type: 'result-received', result: mkResult({ xp_delta: 10 }) })).toBe(s)
  })

  it('pauses only from exploring and resume restores', () => {
    const s = started()
    const paused = runReducer(s, { type: 'pause' })
    expect(paused.phase).toBe('paused')
    expect(runReducer(paused, { type: 'resume' }).phase).toBe('exploring')

    const enc = runReducer(s, { type: 'encounter-started' })
    expect(runReducer(enc, { type: 'pause' })).toBe(enc)
    expect(runReducer(s, { type: 'resume' })).toBe(s)
  })

  it('reset returns initialRunState', () => {
    expect(runReducer(started(), { type: 'reset' })).toEqual(initialRunState)
  })

  it('room-cleared adds xpDelta', () => {
    const s = runReducer(started(), { type: 'room-cleared', xpDelta: 25 })
    expect(s.xp).toBe(25)
    expect(s.phase).toBe('cleared')
  })
})
