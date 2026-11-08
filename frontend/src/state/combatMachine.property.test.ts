import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import demo from '@/demo/demoDungeon.json'
import { applyAnswer, BOSS_PROFILE, ROOM_PROFILE, type RulesState } from '@/demo/rules'
import type { AnswerResult, Run } from '@/types/api'
import { canAnswer, canRetreat, isCombatActive } from './combatMachine'
import { initialRunState, runReducer, type RoomInfo, type RunAction, type RunState } from './runReducer'

/* ------------------------------------------------------------------ */
/* Shared generators / helpers (reused by later properties in this file) */
/* ------------------------------------------------------------------ */

const runs = { numRuns: 100 }

const demoRooms: RoomInfo[] = demo.rooms.map((r) => ({
  id: r.id,
  order: r.order,
  is_boss: r.is_boss,
  monster: { max_hp: r.monster.max_hp },
}))

const runFixture: Run = {
  id: 'run-1',
  dungeon_id: demo.id,
  player_hp: 100,
  monster_hp: demoRooms[0].monster.max_hp,
  current_room_id: demoRooms[0].id,
}

/** A started multi-room run, exploring the first room. */
function startedRun(): RunState {
  return runReducer(initialRunState, { type: 'run-started', run: runFixture, rooms: demoRooms })
}

/**
 * Abstract step: result-received carries fractions so the concrete
 * AnswerResult is built against the *current* state (valid hp ranges).
 */
type Step =
  | { kind: 'plain'; type: Exclude<RunAction['type'], 'result-received' | 'run-started' | 'room-entered' | 'room-cleared' | 'gate-opened' | 'run-finished' | 'reset'> }
  | { kind: 'result'; playerHp: number; monsterFrac: number; correct: boolean; streak: number; xp: number; score: number }

const plainTypes = [
  'encounter-started',
  'question-presented',
  'answer-submitted',
  'answer-failed',
  'result-settled',
  'advance',
  'retreat',
  'pause',
  'resume',
] as const

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  { weight: 9, arbitrary: fc.constantFrom(...plainTypes).map((type): Step => ({ kind: 'plain', type })) },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('result' as const),
      playerHp: fc.integer({ min: 0, max: 100 }),
      // 0 and 1 are over-represented so empty/full monster HP are exercised
      monsterFrac: fc.constantFrom(0, 0, 0.25, 0.5, 1),
      correct: fc.boolean(),
      streak: fc.nat(10),
      xp: fc.nat(50),
      score: fc.nat(100),
    }),
  },
)

/** Random sequence of combat/pause steps. */
const stepsArb: fc.Arbitrary<Step[]> = fc.array(stepArb, { minLength: 0, maxLength: 60 })

function toAction(step: Step, state: RunState): RunAction {
  if (step.kind === 'plain') return { type: step.type } as RunAction
  const max = state.maxMonsterHp
  const result: AnswerResult = {
    correct: step.correct,
    damage_dealt: 0,
    monster_hp_remaining: Math.min(max, Math.max(0, Math.round(max * step.monsterFrac))),
    player_hp_remaining: Math.min(state.maxPlayerHp, step.playerHp),
    score_delta: step.score,
    xp_delta: step.xp,
    streak: step.streak,
    source: { page: 1, chunk_id: 'c1' },
    review_status: 'not_due',
  }
  return { type: 'result-received', result }
}

interface Trace {
  before: RunState
  action: RunAction
  after: RunState
}

/** Run a step sequence from a started run, recording every transition. */
function runSteps(steps: readonly Step[], initial: RunState = startedRun()): Trace[] {
  const out: Trace[] = []
  let state = initial
  for (const step of steps) {
    const action = toAction(step, state)
    const after = runReducer(state, action)
    out.push({ before: state, action, after })
    state = after
  }
  return out
}

const startsFresh = (c: RunState['combat']): boolean => c === null || c === 'exited'

/* ------------------------------------------------------------------ */
/* Properties                                                          */
/* ------------------------------------------------------------------ */

describe('combat state machine properties', () => {
  // Feature: frontend-04-rpg-ui-combat-flow, Property 2: One encounter per engagement
  // **Validates: Requirements 1.4, 1.5, 1.6**
  it('Property 2: One encounter per engagement', () => {
    fc.assert(
      fc.property(stepsArb, (steps) => {
        const trace = runSteps(steps)
        let accepted = 0
        let starts = 0
        for (const { before, action, after } of trace) {
          if (action.type === 'encounter-started') {
            if (isCombatActive(before.combat) || before.phase !== 'exploring') {
              expect(after).toBe(before)
            }
            if (after !== before) accepted++
          }
          if (startsFresh(before.combat) && after.combat === 'starting') starts++
          if (isCombatActive(after.combat)) expect(after.phase).not.toBe('exploring')
        }
        expect(accepted).toBe(starts)
      }),
      runs,
    )
  })

  // Feature: frontend-04-rpg-ui-combat-flow, Property 3: Continuous question flow
  // **Validates: Requirements 2.1, 2.2**
  it('Property 3: Continuous question flow', () => {
    const maxMonster = demoRooms[0].monster.max_hp
    const answerArb = fc.record({
      playerHp: fc.integer({ min: 1, max: 100 }),
      monsterHp: fc.integer({ min: 1, max: maxMonster }),
      correct: fc.boolean(),
      injectAt: fc.integer({ min: 0, max: 4 }),
    })
    fc.assert(
      fc.property(fc.array(answerArb, { minLength: 1, maxLength: 15 }), (answers) => {
        let state = runReducer(startedRun(), { type: 'encounter-started' })
        state = runReducer(state, { type: 'question-presented' })
        expect(state.combat).toBe('question')

        const check = (expected: RunState['combat']) => {
          expect(state.combat).toBe(expected)
          expect(isCombatActive(state.combat)).toBe(true)
          expect(state.phase).not.toBe('exploring')
        }
        const apply = (action: RunAction, expected: RunState['combat'], idx: number, at: number) => {
          state = runReducer(state, action)
          check(expected)
          if (idx === at) {
            const again = runReducer(state, { type: 'encounter-started' })
            expect(again).toBe(state)
          }
        }

        for (const a of answers) {
          const result: AnswerResult = {
            correct: a.correct,
            damage_dealt: 0,
            monster_hp_remaining: a.monsterHp,
            player_hp_remaining: a.playerHp,
            score_delta: 0,
            xp_delta: 0,
            streak: 0,
            source: { page: 1, chunk_id: 'c1' },
            review_status: 'not_due',
          }
          apply({ type: 'answer-submitted' }, 'submitting', 0, a.injectAt)
          apply({ type: 'result-received', result }, 'result', 1, a.injectAt)
          apply({ type: 'result-settled' }, 'next', 2, a.injectAt)
          // reducer: advance from 'next' goes straight to 'question'; the trailing
          // question-presented is then an idempotent no-op
          apply({ type: 'advance' }, 'question', 3, a.injectAt)
          apply({ type: 'question-presented' }, 'question', 4, a.injectAt)
        }
      }),
      runs,
    )
  })

  // Feature: frontend-04-rpg-ui-combat-flow, Property 4: At most one submission in flight
  // **Validates: Requirements 3.1, 3.2, 3.3**
  it('Property 4: At most one submission in flight', () => {
    // canAnswer is true only for 'question' (all CombatState values + null)
    const allCombat: RunState['combat'][] = [
      null, 'starting', 'question', 'submitting', 'result', 'next', 'monster_defeated', 'player_defeated', 'exited',
    ]
    for (const c of allCombat) expect(canAnswer(c)).toBe(c === 'question')

    fc.assert(
      fc.property(stepsArb, (steps) => {
        const trace = runSteps(steps)
        // Counting: an "entry into question" is any transition with
        // before.combat !== 'question' and after.combat === 'question'
        // (from starting/next via question-presented or advance, and
        // re-entry from submitting via answer-failed). Each accepted
        // answer-submitted (question -> submitting) consumes one entry, so
        // accepted submissions can never exceed entries.
        let entries = 0
        let accepted = 0
        let prevAcceptedSubmit = false
        for (const { before, action, after } of trace) {
          if (before.combat !== 'question' && after.combat === 'question') entries++
          let acceptedNow = false
          if (action.type === 'answer-submitted') {
            if (before.combat === 'question') {
              expect(after).not.toBe(before)
              expect(after.combat).toBe('submitting')
              acceptedNow = true
              accepted++
            } else {
              expect(after).toBe(before)
            }
            // two consecutive answer-submitted never both change state
            if (prevAcceptedSubmit) expect(acceptedNow).toBe(false)
          }
          prevAcceptedSubmit = acceptedNow
          expect(accepted).toBeLessThanOrEqual(entries)
        }
      }),
      runs,
    )
  })

  // Feature: frontend-04-rpg-ui-combat-flow, Property 5: Next question never before the result settles
  // **Validates: Requirements 2.3**
  it('Property 5: Next question never before the result settles', () => {
    const settledStates: RunState['combat'][] = ['next', 'monster_defeated', 'player_defeated']
    fc.assert(
      fc.property(stepsArb, (steps) => {
        const trace = runSteps(steps)
        let pending = false // accepted answer-submitted awaiting its resolution
        let received = false
        let settled = false
        for (const { before, action, after } of trace) {
          // advance only moves state out of a settled state
          if (action.type === 'advance' && !settledStates.includes(before.combat)) {
            expect(after).toBe(before)
          }
          // entry into a settled state comes only from 'result' via result-settled
          if (!settledStates.includes(before.combat) && settledStates.includes(after.combat)) {
            expect(before.combat).toBe('result')
            expect(action.type).toBe('result-settled')
          }
          // entry into 'result' comes only from 'submitting' via result-received
          if (before.combat !== 'result' && after.combat === 'result') {
            expect(before.combat).toBe('submitting')
            expect(action.type).toBe('result-received')
          }
          // trace-level ordering
          if (action.type === 'answer-submitted' && before.combat === 'question' && after !== before) {
            pending = true
            received = false
            settled = false
          }
          if (pending && action.type === 'result-received' && after !== before) received = true
          if (pending && received && action.type === 'result-settled' && after !== before) settled = true
          if (before.combat !== 'question' && after.combat === 'question' && pending) {
            if (action.type === 'answer-failed') {
              expect(before.combat).toBe('submitting')
            } else {
              expect(received && settled).toBe(true)
            }
            pending = false
          }
          // combat torn down (retreat/exit etc.): the pending submission is abandoned
          if (after.combat === null || after.combat === 'exited' || after.combat === 'starting') {
            pending = false
          }
        }
      }),
      runs,
    )
  })

  // Feature: frontend-04-rpg-ui-combat-flow, Property 6: Encounter ends exactly at zero HP
  // **Validates: Requirements 2.7, 6.1, 7.1**
  it('Property 6: Encounter ends exactly at zero HP', () => {
    const encounterArb = fc.record({
      boss: fc.boolean(),
      playerHp: fc.integer({ min: 1, max: 100 }),
      answers: fc.array(fc.boolean(), { minLength: 1, maxLength: 40 }),
    })
    fc.assert(
      fc.property(encounterArb, ({ boss, playerHp, answers }) => {
        const profile = boss ? BOSS_PROFILE : ROOM_PROFILE
        const monsterMax = boss ? 120 : 60
        const room: RoomInfo = { id: 'r1', order: 1, is_boss: boss, monster: { max_hp: monsterMax } }
        const run: Run = {
          id: 'run-p6',
          dungeon_id: demo.id,
          player_hp: playerHp,
          monster_hp: monsterMax,
          current_room_id: room.id,
        }
        let state = runReducer(initialRunState, { type: 'run-started', run, rooms: [room] })
        state = runReducer(state, { type: 'encounter-started' })
        state = runReducer(state, { type: 'question-presented' })
        let rules: RulesState = { playerHp, monsterHp: monsterMax, streak: 0 }

        let terminal: 'monster_defeated' | 'player_defeated' | null = null
        for (const correct of answers) {
          expect(state.combat).toBe('question')
          const applied = applyAnswer(rules, correct, profile)
          rules = applied.next
          const result: AnswerResult = { ...applied.result, source: { page: 1, chunk_id: 'c1' } }
          state = runReducer(state, { type: 'answer-submitted' })
          state = runReducer(state, { type: 'result-received', result })
          state = runReducer(state, { type: 'result-settled' })

          const monsterDead = result.monster_hp_remaining === 0 && result.player_hp_remaining > 0
          const playerDead = result.player_hp_remaining === 0
          const expected = playerDead ? 'player_defeated' : monsterDead ? 'monster_defeated' : 'next'
          expect(state.combat).toBe(expected)

          if (expected === 'next') {
            state = runReducer(state, { type: 'advance' })
            state = runReducer(state, { type: 'question-presented' })
            continue
          }
          terminal = expected
          break
        }

        if (terminal === null) return
        // no further answers accepted after a terminal
        expect(runReducer(state, { type: 'answer-submitted' })).toBe(state)
        const done = runReducer(state, { type: 'advance' })
        expect(done.combat).toBeNull()
        expect(done.phase).toBe(terminal === 'monster_defeated' ? 'cleared' : 'defeated')
      }),
      runs,
    )
  })

  // Feature: frontend-04-rpg-ui-combat-flow, Property 7: Retreat and pause only from the question state
  // **Validates: Requirements 3.5, 5.1, 5.2, 5.4, 5.5**
  it('Property 7: Retreat and pause only from the question state', () => {
    const allCombat: RunState['combat'][] = [
      null, 'starting', 'question', 'submitting', 'result', 'next', 'monster_defeated', 'player_defeated', 'exited',
    ]
    for (const c of allCombat) expect(canRetreat(c)).toBe(c === 'question')

    fc.assert(
      fc.property(stepsArb, (steps) => {
        const trace = runSteps(steps)
        for (const { before, action, after } of trace) {
          if (action.type === 'retreat') {
            if (before.combat !== 'question') expect(after).toBe(before)
            else {
              expect(after.combat).toBe('exited')
              expect(after.phase).toBe('exploring')
              expect(after.playerHp).toEqual(before.playerHp)
              expect(after.monsterHp).toEqual(before.monsterHp)
              expect(after.roomHp).toEqual(before.roomHp)
            }
          }
          if (action.type === 'pause') {
            const allowed =
              (before.phase === 'exploring' && startsFresh(before.combat)) ||
              (before.phase === 'encounter' && before.combat === 'question')
            if (!allowed) expect(after).toBe(before)
            else {
              expect(after.phase).toBe('paused')
              if (before.combat === 'question') {
                const resumed = runReducer(after, { type: 'resume' })
                expect(resumed.phase).toBe('encounter')
                expect(resumed.combat).toBe('question')
              }
            }
          }
        }
      }),
      runs,
    )
  })

  // Feature: frontend-04-rpg-ui-combat-flow, Property 8: Reducer copies values from the result
  // **Validates: Requirements 3.6**
  it('Property 8: Reducer copies values from the result', () => {
    const maxMonster = demoRooms[0].monster.max_hp
    const resultArb: fc.Arbitrary<AnswerResult> = fc.record(
      {
        correct: fc.boolean(),
        damage_dealt: fc.nat(500),
        monster_hp_remaining: fc.integer({ min: 0, max: maxMonster }),
        player_hp_remaining: fc.integer({ min: 0, max: 100 }),
        score_delta: fc.nat(1000),
        xp_delta: fc.nat(1000),
        streak: fc.nat(50),
        source: fc.record({ page: fc.nat(500), chunk_id: fc.string({ minLength: 1, maxLength: 8 }) }),
        review_status: fc.constantFrom('due' as const, 'not_due' as const),
        explanation: fc.string({ maxLength: 20 }),
      },
      { requiredKeys: ['correct', 'damage_dealt', 'monster_hp_remaining', 'player_hp_remaining', 'score_delta', 'xp_delta', 'streak', 'source', 'review_status'] },
    )
    // optional prior (non-terminal) encounter round so xp/score are non-zero
    const priorArb = fc.option(
      fc.record({
        result: resultArb.map((r): AnswerResult => ({
          ...r,
          player_hp_remaining: Math.max(1, r.player_hp_remaining),
          monster_hp_remaining: Math.max(1, r.monster_hp_remaining),
        })),
      }),
      { nil: null },
    )

    const toSubmitting = (prior: { result: AnswerResult } | null): RunState => {
      let s = runReducer(startedRun(), { type: 'encounter-started' })
      s = runReducer(s, { type: 'question-presented' })
      if (prior) {
        s = runReducer(s, { type: 'answer-submitted' })
        s = runReducer(s, { type: 'result-received', result: prior.result })
        s = runReducer(s, { type: 'result-settled' })
        s = runReducer(s, { type: 'advance' })
        s = runReducer(s, { type: 'question-presented' })
      }
      return runReducer(s, { type: 'answer-submitted' })
    }

    fc.assert(
      fc.property(priorArb, resultArb, fc.nat(500), (prior, result, otherDamage) => {
        const before = toSubmitting(prior)
        expect(before.combat).toBe('submitting')
        const after = runReducer(before, { type: 'result-received', result })

        expect(after.combat).toBe('result')
        expect(after.playerHp).toBe(result.player_hp_remaining)
        expect(after.monsterHp).toBe(result.monster_hp_remaining)
        expect(after.roomHp[before.currentRoomId as string]).toBe(result.monster_hp_remaining)
        expect(after.streak).toBe(result.streak)
        expect(after.xp).toBe(before.xp + result.xp_delta)
        expect(after.score).toBe(before.score + result.score_delta)
        expect(after.lastResult).toBe(result)
        expect(after.prevPlayerHp).toBe(before.playerHp)

        // damage_dealt never drives state: only lastResult may differ
        const other: AnswerResult = { ...result, damage_dealt: otherDamage }
        const afterOther = runReducer(before, { type: 'result-received', result: other })
        expect({ ...afterOther, lastResult: null }).toEqual({ ...after, lastResult: null })
      }),
      runs,
    )

    // result-received outside 'submitting' is a no-op
    fc.assert(
      fc.property(stepsArb, resultArb, (steps, result) => {
        for (const { before } of runSteps(steps)) {
          if (before.combat !== 'submitting') {
            expect(runReducer(before, { type: 'result-received', result })).toBe(before)
          }
        }
      }),
      runs,
    )
  })
})
