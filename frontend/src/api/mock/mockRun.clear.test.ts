import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createMockAdapter } from './mockAdapter'
import { ApiError } from '../errors'
import { answerKey } from './answerKey'
import demoDungeon from '../../demo/demoDungeon.json'

type DemoRoom = (typeof demoDungeon.rooms)[number] & { is_boss?: boolean }
const rooms = demoDungeon.rooms as DemoRoom[]
const roomOfQuestion = new Map<string, DemoRoom>()
for (const room of rooms) {
  for (const qid of room.monster.question_ids) roomOfQuestion.set(qid, room)
}
const questionIds = [...roomOfQuestion.keys()]

const attemptArb = fc.record({
  qIndex: fc.integer({ min: 0, max: questionIds.length - 1 }),
  // Bias toward correct answers so monsters actually reach 0 HP.
  correct: fc.boolean().chain((b) => (b ? fc.constant(true) : fc.boolean())),
})

describe('Property 7: Clear succeeds only at zero monster HP', () => {
  // Feature: frontend-03-phaser-core, Property 7: Clear succeeds only at zero monster HP
  // **Validates: Requirements 7.2, 12.6**
  it('clearRoom succeeds iff the room monster HP is 0, with correct and idempotent xp_delta', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(attemptArb, { maxLength: 80 }),
        fc.integer({ min: 0, max: rooms.length - 1 }),
        async (attempts, roomIndex) => {
          const api = createMockAdapter()
          const run = await api.startRun(demoDungeon.id)
          const hp = new Map(rooms.map((r) => [r.id, r.monster.max_hp]))

          for (const [i, a] of attempts.entries()) {
            const qid = questionIds[a.qIndex]
            try {
              const res = await api.submitAttempt(run.id, {
                attempt_id: `att-${i}`,
                question_id: qid,
                selected_answer: a.correct ? answerKey[qid].correct : '__wrong__',
              })
              hp.set(roomOfQuestion.get(qid)!.id, res.monster_hp_remaining)
            } catch (e) {
              if (!(e instanceof ApiError) || e.status !== 409) throw e
            }
          }

          const room = rooms[roomIndex]
          const expectedXp = room.is_boss ? 100 : 25
          if (hp.get(room.id) === 0) {
            const first = await api.clearRoom(run.id, room.id)
            expect(first.xp_delta).toBe(expectedXp)
            const again = await api.clearRoom(run.id, room.id)
            expect(again.xp_delta).toBe(first.xp_delta)
          } else {
            await expect(api.clearRoom(run.id, room.id)).rejects.toMatchObject({ status: 409 })
          }
        },
      ),
      { numRuns: 150 },
    )
  })

  it('returns 404 for an unknown room', async () => {
    const api = createMockAdapter()
    const run = await api.startRun(demoDungeon.id)
    await expect(api.clearRoom(run.id, 'nope')).rejects.toMatchObject({ status: 404 })
  })
})
