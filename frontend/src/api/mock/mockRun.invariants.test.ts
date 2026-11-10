import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createMockAdapter } from './mockAdapter'
import { ApiError } from '../errors'
import { answerKey } from './answerKey'
import demoDungeon from '../../demo/demoDungeon.json'
import type { Dungeon } from '../../types/api'

const dungeon = demoDungeon as Dungeon
const rooms = dungeon.rooms
const maxHp = new Map(rooms.map((r) => [r.id, r.monster.max_hp]))
const roomOfQuestion = new Map<string, (typeof rooms)[number]>()
for (const room of rooms) for (const q of room.monster.question_ids) roomOfQuestion.set(q, room)
const questionIds = [...roomOfQuestion.keys()]

const stepArb = fc.record({
  qIndex: fc.integer({ min: 0, max: questionIds.length - 1 }),
  wrong: fc.boolean(),
})

describe('Property 6: Mock run invariants across rooms', () => {
  // Feature: frontend-03-phaser-core, Property 6: Mock run invariants across rooms
  // **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.11**
  it('keeps player and per-room monster HP consistent over attempt sequences', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(stepArb, { maxLength: 60 }), async (steps) => {
        const api = createMockAdapter()
        const run = await api.startRun(dungeon.id)
        let playerHp = 100
        const hp = new Map(maxHp)

        for (const [i, step] of steps.entries()) {
          const qid = questionIds[step.qIndex]
          const room = roomOfQuestion.get(qid)!
          const before = new Map(hp)
          const playerBefore = playerHp
          try {
            const r = await api.submitAttempt(run.id, {
              question_id: qid,
              selected_answer: step.wrong ? '__wrong__' : answerKey[qid].correct,
              attempt_id: `a-${i}`,
            })
            const roomBefore = before.get(room.id)!
            expect(r.correct).toBe(!step.wrong)
            // 409 must be thrown for defeated monster / player; so these held:
            expect(roomBefore).toBeGreaterThan(0)
            expect(playerBefore).toBeGreaterThan(0)
            if (step.wrong) {
              const cost = room.is_boss ? 12 : 10
              expect(r.player_hp_remaining).toBe(Math.max(0, playerBefore - cost))
              expect(r.monster_hp_remaining).toBe(roomBefore)
            } else {
              // Damage varies with weapon, hard questions and criticals; the HP drop is exactly what was dealt.
              expect(r.damage_dealt).toBeGreaterThan(0)
              expect(r.monster_hp_remaining).toBe(Math.max(0, roomBefore - r.damage_dealt))
              expect(r.player_hp_remaining).toBe(playerBefore)
            }
            playerHp = r.player_hp_remaining
            hp.set(room.id, r.monster_hp_remaining)
          } catch (e) {
            if (!(e instanceof ApiError)) throw e
            expect(e.status).toBe(409)
            // Rejection only allowed when monster or player is already at 0.
            expect(before.get(room.id)! <= 0 || playerBefore <= 0).toBe(true)
          }

          expect(playerHp).toBeGreaterThanOrEqual(0)
          expect(playerHp).toBeLessThanOrEqual(100)
          expect(playerHp).toBeLessThanOrEqual(playerBefore)
          for (const [id, value] of hp) {
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).toBeLessThanOrEqual(maxHp.get(id)!)
            expect(value).toBeLessThanOrEqual(before.get(id)!)
            if (id !== room.id) expect(value).toBe(before.get(id))
          }
        }
      }),
      { numRuns: 100 },
    )
  })
})
