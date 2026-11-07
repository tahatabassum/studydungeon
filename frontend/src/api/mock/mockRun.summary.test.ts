import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { createMockAdapter } from './mockAdapter'
import { ApiError } from '../errors'
import { answerKey } from './answerKey'
import demoDungeon from '../../demo/demoDungeon.json'
import type { Room } from '../../types/api'

type DemoRoom = Room & { order: number; is_boss: boolean }

const rooms = [...(demoDungeon.rooms as DemoRoom[])].sort((a, b) => a.order - b.order)
const TOPIC_CLEAR_XP = 25
const BOSS_CLEAR_XP = 100

// Wrong answers per room; total capped at 7 so player HP (100) never reaches 0
// (worst case 7 * 12 = 84 damage).
const wrongPlanArb = fc
  .array(fc.integer({ min: 0, max: 4 }), { minLength: rooms.length, maxLength: rooms.length })
  .filter((plan) => plan.reduce((a, b) => a + b, 0) <= 7)

async function statusOf(p: Promise<unknown>): Promise<number | null> {
  try {
    await p
    return null
  } catch (e) {
    if (e instanceof ApiError) return e.status
    throw e
  }
}

describe('Property 8: Run summary consistency', () => {
  // Feature: frontend-03-phaser-core, Property 8: Run summary consistency
  // **Validates: Requirements 8.5, 8.6**
  it('summary matches accepted attempts; finishRun is rejected before boss clear', async () => {
    await fc.assert(
      fc.asyncProperty(wrongPlanArb, async (wrongPlan) => {
        const api = createMockAdapter()
        const run = await api.startRun(demoDungeon.id)
        let attemptNo = 0
        let correct = 0
        let total = 0
        let score = 0
        let xp = 0

        // 8.6: finishRun before boss is defeated is rejected with 409
        expect(await statusOf(api.finishRun(run.id))).toBe(409)

        for (let i = 0; i < rooms.length; i++) {
          const room = rooms[i]
          const pool = room.monster.question_ids
          let wrongLeft = wrongPlan[i]
          let asked = 0
          let hp = room.monster.max_hp
          while (hp > 0) {
            const qid = pool[asked % pool.length]
            asked += 1
            const wrong = wrongLeft > 0
            if (wrong) wrongLeft -= 1
            const res = await api.submitAttempt(run.id, {
              attempt_id: `att-${(attemptNo += 1)}`,
              question_id: qid,
              selected_answer: wrong ? '__definitely-wrong__' : answerKey[qid].correct,
            })
            total += 1
            if (!wrong) correct += 1
            score += res.score_delta
            xp += res.xp_delta
            hp = res.monster_hp_remaining
          }
          const clear = await api.clearRoom(run.id, room.id)
          expect(clear.xp_delta).toBe(room.is_boss ? BOSS_CLEAR_XP : TOPIC_CLEAR_XP)
          xp += clear.xp_delta
          if (!room.is_boss) expect(await statusOf(api.finishRun(run.id))).toBe(409)
        }

        const summary = await api.finishRun(run.id)
        expect(summary.correct).toBe(correct)
        expect(summary.total).toBe(total)
        expect(summary.accuracy).toBe(total === 0 ? 0 : correct / total)
        expect(summary.accuracy).toBeGreaterThanOrEqual(0)
        expect(summary.accuracy).toBeLessThanOrEqual(1)
        expect(summary.score).toBe(score)
        expect(summary.xp).toBe(xp)

        // repeated finishRun returns an equal summary
        expect(await api.finishRun(run.id)).toEqual(summary)
      }),
      { numRuns: 100 },
    )
  })

  it('summary xp includes 4 topic clears and the boss clear', async () => {
    const api = createMockAdapter()
    const run = await api.startRun(demoDungeon.id)
    let n = 0
    let answerXp = 0
    for (const room of rooms) {
      const pool = room.monster.question_ids
      let hp = room.monster.max_hp
      let i = 0
      while (hp > 0) {
        const qid = pool[i++ % pool.length]
        const r = await api.submitAttempt(run.id, {
          attempt_id: `a${(n += 1)}`,
          question_id: qid,
          selected_answer: answerKey[qid].correct,
        })
        answerXp += r.xp_delta
        hp = r.monster_hp_remaining
      }
      await api.clearRoom(run.id, room.id)
    }
    const summary = await api.finishRun(run.id)
    expect(summary.xp).toBe(answerXp + 25 * 4 + 100)
    expect(summary.accuracy).toBe(1)
  })
})
