import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { runReducer, initialRunState, type RunAction, type RunState, type RoomInfo } from './runReducer'
import type { AnswerResult, Run, RunSummary } from '@/types/api'

// Feature: frontend-03-phaser-core, Property 10: Reducer copies authoritative values and gates victory
// **Validates: Requirements 12.4, 12.5, 12.7**

const ROOMS: RoomInfo[] = [
  { id: 'r1', order: 1, is_boss: false, monster: { max_hp: 60 } },
  { id: 'r2', order: 2, is_boss: false, monster: { max_hp: 60 } },
  { id: 'r3', order: 3, is_boss: true, monster: { max_hp: 120 } },
]
const IDS = ROOMS.map((r) => r.id)

const run: Run = { id: 'run-1', dungeon_id: 'd', player_hp: 100, monster_hp: 60, current_room_id: 'r1' }
const started = (): RunState => runReducer(initialRunState, { type: 'run-started', run, rooms: ROOMS })

const resultArb: fc.Arbitrary<AnswerResult> = fc.record({
  correct: fc.boolean(),
  damage_dealt: fc.nat(50),
  monster_hp_remaining: fc.integer({ min: 0, max: 120 }),
  player_hp_remaining: fc.integer({ min: 0, max: 100 }),
  score_delta: fc.integer({ min: 0, max: 500 }),
  xp_delta: fc.integer({ min: 0, max: 100 }),
  streak: fc.nat(30),
  source: fc.record({ page: fc.nat(100), chunk_id: fc.string() }),
  review_status: fc.constantFrom('due' as const, 'not_due' as const),
})

const summaryArb: fc.Arbitrary<RunSummary> = fc.record({
  score: fc.nat(10000),
  xp: fc.nat(1000),
  correct: fc.nat(100),
  total: fc.nat(100),
  accuracy: fc.double({ min: 0, max: 1, noNaN: true }),
})

const roomIdArb = fc.constantFrom(...IDS)

const actionArb: fc.Arbitrary<RunAction> = fc.oneof(
  roomIdArb.map((roomId): RunAction => ({ type: 'room-entered', roomId })),
  fc.constant<RunAction>({ type: 'encounter-started' }),
  fc.constantFrom<RunAction>(
    { type: 'question-presented' },
    { type: 'answer-submitted' },
    { type: 'answer-failed' },
    { type: 'advance' },
    { type: 'retreat' },
  ),
  resultArb.map((result): RunAction => ({ type: 'result-received', result })),
  fc.constant<RunAction>({ type: 'result-settled' }),
  fc.tuple(roomIdArb, fc.nat(100)).map(([roomId, xpDelta]): RunAction => ({ type: 'room-cleared', roomId, xpDelta })),
  fc.constant<RunAction>({ type: 'gate-opened' }),
  summaryArb.map((summary): RunAction => ({ type: 'run-finished', summary })),
  fc.constant<RunAction>({ type: 'pause' }),
  fc.constant<RunAction>({ type: 'resume' }),
)

describe('Property 10: Reducer copies authoritative values and gates victory', () => {
  it('(a) result-received copies authoritative values and adds deltas exactly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...IDS),
        resultArb,
        fc.nat(1000),
        fc.nat(1000),
        (roomId, result, xp, score) => {
          const base: RunState = {
            ...started(),
            phase: 'encounter',
            combat: 'submitting',
            currentRoomId: roomId,
            xp,
            score,
          }
          const next = runReducer(base, { type: 'result-received', result })
          expect(next.combat).toBe('result')
          expect(next.playerHp).toBe(result.player_hp_remaining)
          expect(next.monsterHp).toBe(result.monster_hp_remaining)
          expect(next.roomHp[roomId]).toBe(result.monster_hp_remaining)
          expect(next.streak).toBe(result.streak)
          expect(next.xp).toBe(xp + result.xp_delta)
          expect(next.score).toBe(score + result.score_delta)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('(b) victory only when boss cleared and a run-finished summary was received', () => {
    fc.assert(
      fc.property(fc.array(actionArb, { maxLength: 60 }), (actions) => {
        let state = started()
        let accepted: RunSummary | null = null
        for (const action of actions) {
          const before = state
          state = runReducer(state, action)
          if (action.type === 'run-finished') {
            const bossCleared = !!before.bossRoomId && before.clearedRoomIds.includes(before.bossRoomId)
            if (!bossCleared) {
              expect(state).toBe(before)
            } else {
              expect(state.summary).toBe(action.summary)
              expect(state.phase).toBe('victory')
              accepted = action.summary
            }
          }
          if (state.phase === 'victory') {
            expect(state.bossRoomId).not.toBeNull()
            expect(state.clearedRoomIds).toContain(state.bossRoomId)
            expect(state.summary).not.toBeNull()
            expect(state.summary).toBe(accepted)
          }
        }
      }),
      { numRuns: 200 },
    )
  })

  it('run-finished before the boss is cleared is ignored', () => {
    const s = started()
    const summary: RunSummary = { score: 1, xp: 2, correct: 3, total: 4, accuracy: 0.75 }
    expect(runReducer(s, { type: 'run-finished', summary })).toBe(s)
  })
})
