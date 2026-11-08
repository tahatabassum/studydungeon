import { describe, expect, it } from 'vitest'
import type { AnswerResult } from '@/types/api'
import { initialRunState, runReducer, type RoomInfo, type RunAction, type RunState } from './runReducer'

const ROOMS: RoomInfo[] = [
  { id: 'r1', order: 1, is_boss: false, monster: { max_hp: 60 } },
  { id: 'r2', order: 2, is_boss: true, monster: { max_hp: 120 } },
]
const run = { id: 'run', dungeon_id: 'd', player_hp: 100, monster_hp: 60, current_room_id: 'r1' }

const result = (over: Partial<AnswerResult>): AnswerResult => ({
  correct: true,
  damage_dealt: 0,
  monster_hp_remaining: 0,
  player_hp_remaining: 100,
  score_delta: 100,
  xp_delta: 10,
  streak: 1,
  source: { page: 1, chunk_id: 'c' },
  review_status: 'not_due',
  ...over,
})

function reduce(state: RunState, ...actions: RunAction[]): RunState {
  return actions.reduce(runReducer, state)
}

/** Room r1 cleared and its gate open: the player is exploring with the monster at 0 HP. */
function afterRoomCleared(): RunState {
  return reduce(
    runReducer(initialRunState, { type: 'run-started', run, rooms: ROOMS }),
    { type: 'encounter-started' },
    { type: 'question-presented' },
    { type: 'answer-submitted' },
    { type: 'result-received', result: result({ damage_dealt: 20, monster_hp_remaining: 0 }) },
    { type: 'result-settled' },
    { type: 'advance' },
    { type: 'room-cleared', roomId: 'r1', xpDelta: 25 },
    { type: 'gate-opened', roomId: 'r1' },
  )
}

describe('Revenant encounters in runReducer', () => {
  it('start from the cleared state with the room monster at 0 HP', () => {
    const s = afterRoomCleared()
    expect(s.phase).toBe('exploring')
    expect(s.monsterHp).toBe(0)
    expect(s.roomHp.r1).toBe(0)
    expect(s.clearedRoomIds).toEqual(['r1'])
  })

  it('a wrong Revenant answer costs player HP and leaves the room monster and cleared rooms alone', () => {
    const base = afterRoomCleared()
    const s = reduce(
      base,
      { type: 'encounter-started', revenant: true },
      { type: 'question-presented' },
      { type: 'answer-submitted' },
      { type: 'result-received', result: result({ correct: false, player_hp_remaining: 90, streak: 0, score_delta: 0, xp_delta: 0 }) },
    )
    expect(s.revenantActive).toBe(true)
    expect(s.combat).toBe('result')
    expect(s.playerHp).toBe(90)
    expect(s.streak).toBe(0)
    expect(s.monsterHp).toBe(0)
    expect(s.roomHp).toEqual(base.roomHp)
    const settled = runReducer(s, { type: 'result-settled' })
    // The defeated room monster must not read as a fresh monster defeat.
    expect(settled.combat).toBe('next')
  })

  it('a correct Revenant answer adds score and XP, then revenant-finished returns to exploring', () => {
    const base = afterRoomCleared()
    const s = reduce(
      base,
      { type: 'encounter-started', revenant: true },
      { type: 'question-presented' },
      { type: 'answer-submitted' },
      { type: 'result-received', result: result({ streak: 4 }) },
      { type: 'result-settled' },
      { type: 'revenant-finished' },
    )
    expect(s.phase).toBe('exploring')
    expect(s.combat).toBeNull()
    expect(s.revenantActive).toBe(false)
    expect(s.score).toBe(base.score + 100)
    expect(s.xp).toBe(base.xp + 10)
    expect(s.streak).toBe(4)
    expect(s.monsterHp).toBe(0)
    expect(s.roomHp).toEqual(base.roomHp)
    expect(s.clearedRoomIds).toEqual(base.clearedRoomIds)
    expect(s.currentRoomId).toBe(base.currentRoomId)
  })

  it('defeats the player normally when a Revenant answer drops HP to 0', () => {
    const s = reduce(
      afterRoomCleared(),
      { type: 'encounter-started', revenant: true },
      { type: 'question-presented' },
      { type: 'answer-submitted' },
      { type: 'result-received', result: result({ correct: false, player_hp_remaining: 0, streak: 0 }) },
      { type: 'result-settled' },
    )
    expect(s.combat).toBe('player_defeated')
    expect(runReducer(s, { type: 'advance' })).toMatchObject({ phase: 'defeated', revenantActive: false })
  })

  it('retreat leaves a Revenant without touching the monster', () => {
    const base = afterRoomCleared()
    const s = reduce(base, { type: 'encounter-started', revenant: true }, { type: 'question-presented' }, { type: 'retreat' })
    expect(s).toMatchObject({ phase: 'exploring', combat: 'exited', revenantActive: false, monsterHp: 0 })
  })

  it('revenant-finished does nothing outside a settled Revenant encounter', () => {
    const base = afterRoomCleared()
    expect(runReducer(base, { type: 'revenant-finished' })).toBe(base)
  })

  it('a normal monster encounter is unchanged (revenantActive stays false)', () => {
    const s = reduce(runReducer(initialRunState, { type: 'run-started', run, rooms: ROOMS }), { type: 'encounter-started' })
    expect(s.revenantActive).toBe(false)
  })
})
