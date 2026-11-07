import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { runReducer, initialRunState, type RunAction, type RunState, type RoomInfo } from './runReducer'
import type { AnswerResult } from '@/types/api'

function makeRooms(n: number): RoomInfo[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `room-${i + 1}`,
    order: i + 1,
    is_boss: i === n - 1,
    monster: { max_hp: i === n - 1 ? 120 : 60 },
  }))
}

function result(monsterHp: number, playerHp: number): AnswerResult {
  return {
    correct: monsterHp === 0,
    player_hp_remaining: playerHp,
    monster_hp_remaining: monsterHp,
    streak: 0,
    xp_delta: 0,
    score_delta: 0,
  } as unknown as AnswerResult
}

type Spec =
  | { k: 'enter'; room: number }
  | { k: 'result'; monsterHp: number; playerHp: number }
  | { k: 'clear'; room: number; xp: number }
  | { k: 'gate' }
  | { k: 'encounter' }
  | { k: 'settle' }
  | { k: 'flow'; a: 'present' | 'submit' | 'fail' | 'advance' | 'retreat' }

const specArb: fc.Arbitrary<Spec> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ k: fc.constant('enter' as const), room: fc.nat(7) }) },
  {
    weight: 3,
    arbitrary: fc.record({
      k: fc.constant('result' as const),
      monsterHp: fc.constantFrom(0, 0, 20, 40, 60),
      playerHp: fc.integer({ min: 1, max: 100 }),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({ k: fc.constant('clear' as const), room: fc.nat(7), xp: fc.integer({ min: 1, max: 100 }) }),
  },
  { weight: 2, arbitrary: fc.constant({ k: 'gate' as const }) },
  { weight: 2, arbitrary: fc.constant({ k: 'encounter' as const }) },
  { weight: 2, arbitrary: fc.constant({ k: 'settle' as const }) },
  {
    weight: 6,
    arbitrary: fc.record({
      k: fc.constant('flow' as const),
      a: fc.constantFrom('present' as const, 'submit' as const, 'fail' as const, 'advance' as const, 'retreat' as const),
    }),
  },
)

function toAction(s: Spec, ids: string[]): RunAction {
  switch (s.k) {
    case 'enter':
      // index may exceed the list to also exercise unknown ids
      return { type: 'room-entered', roomId: ids[s.room] ?? 'room-unknown' }
    case 'result':
      return { type: 'result-received', result: result(s.monsterHp, s.playerHp) }
    case 'clear':
      return { type: 'room-cleared', roomId: ids[s.room] ?? 'room-unknown', xpDelta: s.xp }
    case 'gate':
      return { type: 'gate-opened' }
    case 'encounter':
      return { type: 'encounter-started' }
    case 'settle':
      return { type: 'result-settled' }
    case 'flow':
      return {
        present: { type: 'question-presented' },
        submit: { type: 'answer-submitted' },
        fail: { type: 'answer-failed' },
        advance: { type: 'advance' },
        retreat: { type: 'retreat' },
      }[s.a] as RunAction
  }
}

describe('runReducer room ordering', () => {
  // Feature: frontend-03-phaser-core, Property 9: Reducer room ordering
  // **Validates: Requirements 12.1, 12.2, 12.3, 12.6**
  it('Property 9: Reducer room ordering', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 6 }), fc.array(specArb, { maxLength: 80 }), (n, specs) => {
        const rooms = makeRooms(n)
        const ids = rooms.map((r) => r.id)
        let state: RunState = runReducer(initialRunState, {
          type: 'run-started',
          run: { id: 'run', dungeon_id: 'd', player_hp: 100, monster_hp: 60, current_room_id: ids[0] },
          rooms,
        })
        const xpFromClears = new Map<string, number>()

        for (const spec of specs) {
          const action = toAction(spec, ids)
          const prev = state
          state = runReducer(prev, action)

          // Current room changes only via room-entered, to a room whose predecessor is cleared
          if (state.currentRoomId !== prev.currentRoomId) {
            expect(action.type).toBe('room-entered')
            const idx = ids.indexOf(state.currentRoomId as string)
            expect(idx).toBeGreaterThanOrEqual(0)
            if (idx > 0) expect(prev.clearedRoomIds).toContain(ids[idx - 1])
            // never skips ahead: reachable only up to first uncleared room
            for (let j = 0; j < idx; j++) expect(prev.clearedRoomIds).toContain(ids[j])
          }

          // clearedRoomIds never shrinks, has no duplicates
          for (const c of prev.clearedRoomIds) expect(state.clearedRoomIds).toContain(c)
          expect(new Set(state.clearedRoomIds).size).toBe(state.clearedRoomIds.length)

          // newly cleared rooms had remembered HP 0 at clear time, and XP applied exactly once
          const added = state.clearedRoomIds.filter((c) => !prev.clearedRoomIds.includes(c))
          expect(added.length).toBeLessThanOrEqual(1)
          if (added.length === 1) {
            expect(action.type).toBe('room-cleared')
            expect(prev.roomHp[added[0]]).toBe(0)
            expect(state.xp - prev.xp).toBe((action as { xpDelta: number }).xpDelta)
            expect(xpFromClears.has(added[0])).toBe(false)
            xpFromClears.set(added[0], state.xp - prev.xp)
          } else if (action.type === 'room-cleared') {
            expect(state.xp).toBe(prev.xp)
          }
        }
        // cleared set only contains known rooms
        for (const c of state.clearedRoomIds) expect(ids).toContain(c)
      }),
      { numRuns: 200 },
    )
  })
})
