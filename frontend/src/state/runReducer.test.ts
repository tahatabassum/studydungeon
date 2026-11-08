/*
 * Deliberate changes for frontend-04 (combat state machine):
 * - Sequences now go encounter-started -> question-presented -> answer-submitted
 *   -> result-received -> result-settled -> advance (result-received needs combat 'submitting').
 * - result-settled no longer sets defeated/cleared/exploring; it sets combat
 *   player_defeated / monster_defeated / next. `advance` then yields phase defeated / cleared,
 *   or (from 'next') phase 'encounter' with combat 'question' instead of 'exploring'.
 * - pause is also accepted from encounter + combat 'question'.
 * - room-cleared still works after advance from monster_defeated (phase 'cleared').
 */
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { applyAnswer, INITIAL_STATE, type RulesState } from '@/demo/rules'
import type { AnswerResult, Run } from '@/types/api'
import { initialRunState, runReducer, type RunAction, type RunState } from './runReducer'

const runs = { numRuns: 100 }

const run: Run = { id: 'r1', dungeon_id: 'd1', player_hp: 100, monster_hp: 60, current_room_id: 'room-1' }

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

/** Bring combat to 'question' (start encounter / advance from 'next' as needed). */
const present = (s: RunState): RunState => {
  if (s.combat === null || s.combat === 'exited') {
    return reduce(s, { type: 'encounter-started' }, { type: 'question-presented' })
  }
  if (s.combat === 'next') return runReducer(s, { type: 'advance' })
  return s
}

/** question -> submitting -> result. */
const receive = (s: RunState, result: AnswerResult): RunState =>
  reduce(present(s), { type: 'answer-submitted' }, { type: 'result-received', result })

/** Drive one result through the full flow, ending after `advance`. */
const settle = (s: RunState, result: AnswerResult): RunState =>
  reduce(receive(s, result), { type: 'result-settled' }, { type: 'advance' })

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
          const before = reduce(
            { ...started(), xp, score },
            { type: 'encounter-started' },
            { type: 'question-presented' },
            { type: 'answer-submitted' },
          )
          expect(before.phase).toBe('encounter')
          expect(before.combat).toBe('submitting')
          const after = runReducer(before, { type: 'result-received', result })
          expect(after.playerHp).toBe(result.player_hp_remaining)
          expect(after.monsterHp).toBe(result.monster_hp_remaining)
          expect(after.streak).toBe(result.streak)
          expect(after.xp).toBe(xp + result.xp_delta)
          expect(after.score).toBe(score + result.score_delta)
          expect(after.phase).toBe('resolving')
          expect(after.combat).toBe('result')
          expect(after.prevPlayerHp).toBe(before.playerHp)
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
          state = receive(state, full)
          expect(state.monsterHp).toBeLessThanOrEqual(prevMonster)
          state = runReducer(state, { type: 'result-settled' })
          expect(state.playerHp).toBeGreaterThanOrEqual(0)
          expect(state.playerHp).toBeLessThanOrEqual(100)
          expect(state.monsterHp).toBeGreaterThanOrEqual(0)
          expect(state.monsterHp).toBeLessThanOrEqual(60)
          expect(state.combat === 'player_defeated').toBe(state.playerHp === 0)
          expect(state.combat === 'monster_defeated').toBe(state.playerHp > 0 && state.monsterHp === 0)
          if (state.playerHp > 0 && state.monsterHp > 0) expect(state.combat).toBe('next')
          state = runReducer(state, { type: 'advance' })
          expect(state.phase === 'defeated').toBe(state.playerHp === 0)
          expect(state.phase === 'cleared').toBe(state.playerHp > 0 && state.monsterHp === 0)
          if (state.playerHp > 0 && state.monsterHp > 0) {
            expect(state.phase).toBe('encounter')
            expect(state.combat).toBe('question')
          }
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
      if (i < 9) expect(state.phase).toBe('encounter')
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

  it('result leaving HP at 1 -> next question (encounter / question)', () => {
    const s = settle(started(), mkResult({ player_hp_remaining: 1, monster_hp_remaining: 1 }))
    expect(s.phase).toBe('encounter')
    expect(s.combat).toBe('question')
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

    const q = present(s)
    const pausedQ = runReducer(q, { type: 'pause' })
    expect(pausedQ.phase).toBe('paused')
    expect(pausedQ.combat).toBe('question')
    const resumed = runReducer(pausedQ, { type: 'resume' })
    expect(resumed.phase).toBe('encounter')
    expect(resumed.combat).toBe('question')
    const submitting = runReducer(q, { type: 'answer-submitted' })
    expect(runReducer(submitting, { type: 'pause' })).toBe(submitting)
  })

  it('combat transitions are guarded', () => {
    const s = started()
    expect(s.combat).toBeNull()
    for (const type of ['question-presented', 'answer-submitted', 'answer-failed', 'advance', 'retreat'] as const) {
      expect(runReducer(s, { type })).toBe(s)
    }
    const starting = runReducer(s, { type: 'encounter-started' })
    expect(starting.combat).toBe('starting')
    expect(runReducer(starting, { type: 'encounter-started' })).toBe(starting)
    const q = runReducer(starting, { type: 'question-presented' })
    expect(q.combat).toBe('question')
    expect(runReducer(q, { type: 'question-presented' })).toBe(q)
    const sub = runReducer(q, { type: 'answer-submitted' })
    expect(sub.combat).toBe('submitting')
    expect(runReducer(sub, { type: 'answer-submitted' })).toBe(sub)
    expect(runReducer(sub, { type: 'retreat' })).toBe(sub)
    expect(runReducer(sub, { type: 'answer-failed' }).combat).toBe('question')
    expect(runReducer(q, { type: 'result-received', result: mkResult() })).toBe(q)
    expect(runReducer(sub, { type: 'result-settled' })).toBe(sub)
  })

  it('retreat leaves HP unchanged and allows a new encounter', () => {
    const q = present(started())
    const out = runReducer(q, { type: 'retreat' })
    expect(out.phase).toBe('exploring')
    expect(out.combat).toBe('exited')
    expect(out.playerHp).toBe(q.playerHp)
    expect(out.monsterHp).toBe(q.monsterHp)
    expect(runReducer(out, { type: 'encounter-started' }).combat).toBe('starting')
  })

  it('result-received stores prevPlayerHp and run-started/reset clear combat', () => {
    const r = receive(started(), mkResult({ player_hp_remaining: 80 }))
    expect(r.prevPlayerHp).toBe(100)
    expect(r.playerHp).toBe(80)
    expect(runReducer(r, { type: 'reset' }).combat).toBeNull()
    expect(runReducer(r, { type: 'run-started', run }).combat).toBeNull()
  })

  it('player 0 wins ties at result-settled', () => {
    const r = reduce(receive(started(), mkResult({ player_hp_remaining: 0, monster_hp_remaining: 0 })), {
      type: 'result-settled',
    })
    expect(r.combat).toBe('player_defeated')
    expect(r.phase).toBe('resolving')
  })

  it('reset returns initialRunState', () => {
    expect(runReducer(started(), { type: 'reset' })).toEqual(initialRunState)
  })

  it('room-cleared is ignored while the remembered room HP is above 0', () => {
    const s = started()
    expect(runReducer(s, { type: 'room-cleared', xpDelta: 25 })).toBe(s)
  })

  it('room-cleared adds xpDelta once when room HP is 0', () => {
    const s = runReducer(settle(started(), mkResult({ monster_hp_remaining: 0, xp_delta: 5 })), {
      type: 'room-cleared',
      xpDelta: 25,
    })
    expect(s.xp).toBe(30)
    expect(s.phase).toBe('cleared')
    expect(s.clearedRoomIds).toEqual(['room-1'])
    expect(runReducer(s, { type: 'room-cleared', xpDelta: 25 })).toBe(s)
    expect(runReducer(s, { type: 'gate-opened' }).phase).toBe('exploring')
  })
})

const mkRoom = (id: string, order: number, boss = false) => ({
  id,
  order,
  is_boss: boss,
  monster: { max_hp: boss ? 120 : 60 },
})
const rooms = [mkRoom('a', 1), mkRoom('b', 2), mkRoom('c', 3, true)]
const multi = (): RunState =>
  runReducer(initialRunState, { type: 'run-started', run: { ...run, current_room_id: 'a' }, rooms: [...rooms].reverse() })

/** Defeat the monster of the current room and clear it. */
const clearCurrent = (s: RunState, xp = 25): RunState =>
  runReducer(settle(s, mkResult({ monster_hp_remaining: 0 })), { type: 'room-cleared', xpDelta: xp })

describe('runReducer multi-room', () => {
  it('run-started stores order, boss and per-room HP', () => {
    const s = multi()
    expect(s.roomOrder).toEqual(['a', 'b', 'c'])
    expect(s.currentRoomId).toBe('a')
    expect(s.bossRoomId).toBe('c')
    expect(s.roomMaxHp).toEqual({ a: 60, b: 60, c: 120 })
    expect(s.roomHp).toEqual({ a: 60, b: 60, c: 120 })
  })

  it('Feature: frontend-03-phaser-core, Property 9: room-entered only after predecessor cleared', () => {
    // **Validates: Requirements 12.1, 12.2, 12.3, 12.6**
    const actionArb: fc.Arbitrary<RunAction> = fc.oneof(
      fc.constantFrom('a', 'b', 'c', 'x').map((roomId): RunAction => ({ type: 'room-entered', roomId })),
      fc.constantFrom('a', 'b', 'c').map((roomId): RunAction => ({ type: 'room-cleared', roomId, xpDelta: 1 })),
      fc.constantFrom(0, 30, 60).map(
        (hp): RunAction => ({ type: 'result-received', result: mkResult({ monster_hp_remaining: hp }) }),
      ),
      fc.constantFrom<RunAction>(
        { type: 'encounter-started' },
        { type: 'question-presented' },
        { type: 'answer-submitted' },
        { type: 'advance' },
        { type: 'result-settled' },
        { type: 'gate-opened' },
      ),
    )
    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: 40 }), (actions) => {
        let s = multi()
        for (const a of actions) {
          const prev = s
          s = runReducer(s, a)
          if (s.currentRoomId !== prev.currentRoomId) {
            expect(a.type).toBe('room-entered')
            const idx = s.roomOrder.indexOf(s.currentRoomId as string)
            expect(idx === 0 || s.clearedRoomIds.includes(s.roomOrder[idx - 1])).toBe(true)
            expect(s.monsterHp).toBe(s.roomHp[s.currentRoomId as string])
          }
          for (const id of s.clearedRoomIds) expect(s.roomHp[id]).toBe(0)
        }
      }),
      runs,
    )
  })

  it('walks rooms in order and remembers HP', () => {
    let s = multi()
    expect(runReducer(s, { type: 'room-entered', roomId: 'b' })).toBe(s)
    s = settle(s, mkResult({ monster_hp_remaining: 20 }))
    expect(s.roomHp.a).toBe(20)
    s = clearCurrent(s)
    s = reduce(s, { type: 'gate-opened', roomId: 'a' }, { type: 'room-entered', roomId: 'b' })
    expect(s.currentRoomId).toBe('b')
    expect(s.monsterHp).toBe(60)
    expect(s.maxMonsterHp).toBe(60)
    expect(runReducer(s, { type: 'room-entered', roomId: 'c' })).toBe(s)
  })

  it('Feature: frontend-03-phaser-core, Property 10: victory only after boss cleared and summary stored', () => {
    // **Validates: Requirements 12.4, 12.5, 12.7**
    const summary = { score: 1, xp: 2, correct: 3, total: 4, accuracy: 0.75 }
    let s = multi()
    expect(runReducer(s, { type: 'run-finished', summary })).toBe(s)
    s = reduce(clearCurrent(s), { type: 'gate-opened' }, { type: 'room-entered', roomId: 'b' })
    s = reduce(clearCurrent(s), { type: 'gate-opened' }, { type: 'room-entered', roomId: 'c' })
    expect(runReducer(s, { type: 'run-finished', summary })).toBe(s)
    s = clearCurrent(s, 100)
    expect(s.phase).toBe('cleared')
    expect(s.summary).toBeNull()
    s = runReducer(s, { type: 'run-finished', summary })
    expect(s.phase).toBe('victory')
    expect(s.summary).toEqual(summary)
    expect(s.xp).toBe(150)
  })

  it('Feature: frontend-03-phaser-core, Property 10: result-received copies values', () => {
    // **Validates: Requirements 12.4, 12.7**
    fc.assert(
      fc.property(resultArb, (result) => {
        const s = receive(multi(), result)
        expect(s.playerHp).toBe(result.player_hp_remaining)
        expect(s.monsterHp).toBe(result.monster_hp_remaining)
        expect(s.streak).toBe(result.streak)
        expect(s.xp).toBe(result.xp_delta)
        expect(s.roomHp.a).toBe(result.monster_hp_remaining)
        expect(s.phase).not.toBe('victory')
      }),
      runs,
    )
  })
})