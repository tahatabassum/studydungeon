import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import demoDungeon from '../../demo/demoDungeon.json'
import type { Dungeon } from '../../types/api'
import { answerKey } from './answerKey'
import { createMockAdapter } from './mockAdapter'
import { SEED_PER_ROOM } from './mockReviews'

const dungeon = demoDungeon as unknown as Dungeon
const rooms = [...dungeon.rooms].sort((a, b) => a.order - b.order)
const topicQuestions = rooms.filter((r) => !r.is_boss).flatMap((r) => r.monster.question_ids)
const questionById = new Map(dungeon.questions.map((q) => [q.id, q]))

/** A selection that is wrong for the question (any option other than the key). */
function wrongOption(qid: string): string {
  const q = questionById.get(qid)!
  return q.options.find((o) => o !== answerKey[qid].correct) ?? '__wrong__'
}

const stepArb = fc.record({
  q: fc.integer({ min: 0, max: topicQuestions.length - 1 }),
  correct: fc.boolean(),
})

describe('Mock_Adapter due reviews', () => {
  // Feature: frontend-07-premium-ux-leaderboard, Property 11: Mock due reviews follow wrong answers
  // **Validates: Requirements 9.9**
  it('Property 11: due question ids equal the questions whose latest answer was wrong', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(stepArb, { maxLength: 40 }), async (steps) => {
        const api = createMockAdapter({ seedRevenants: false })
        const run = await api.startRun(dungeon.id)
        /** Latest answer per question, updated only when the attempt was accepted. */
        const latest = new Map<string, boolean>()
        let n = 0
        for (const step of steps) {
          const qid = topicQuestions[step.q]
          try {
            await api.submitAttempt(run.id, {
              question_id: qid,
              selected_answer: step.correct ? answerKey[qid].correct : wrongOption(qid),
              attempt_id: `p11-${n++}`,
            })
            latest.set(qid, step.correct)
          } catch {
            // 409: monster already defeated (and not due) or the player is defeated. Not recorded.
          }
        }
        const expected = [...latest].filter(([, correct]) => !correct).map(([qid]) => qid).sort()
        const due = await api.getDueReviews(dungeon.id)
        expect(due.map((r) => r.question.id).sort()).toEqual(expected)
        expect((await api.getProgress()).due_review_count).toBe(expected.length)
      }),
      { numRuns: 100 },
    )
  })

  it('has no due reviews before any answer', async () => {
    const api = createMockAdapter({ seedRevenants: false })
    expect(await api.getDueReviews(dungeon.id)).toEqual([])
    expect((await api.getProgress()).due_review_count).toBe(0)
  })

  it('seeds three reviews per non-boss room when seeding is on, without answers', async () => {
    const api = createMockAdapter({ seedRevenants: true })
    const due = await api.getDueReviews(dungeon.id)
    const topicRooms = rooms.filter((r) => !r.is_boss)
    expect(due).toHaveLength(topicRooms.length * SEED_PER_ROOM)
    for (const room of topicRooms) {
      expect(due.filter((r) => r.room_id === room.id)).toHaveLength(SEED_PER_ROOM)
    }
    for (const r of due) expect(Object.keys(r.question).sort()).toEqual(['id', 'options', 'prompt', 'type'])
    expect((await api.getProgress()).due_review_count).toBe(due.length)
  })

  it('a revenant attempt never changes the defeated room monster, and costs 10 HP when wrong', async () => {
    const api = createMockAdapter({ seedRevenants: false })
    const run = await api.startRun(dungeon.id)
    const room = rooms[0]
    const [q1, q2, q3, q4] = room.monster.question_ids
    // Miss q4 once, then defeat the monster with correct answers (80 HP: 20 + 20 + 30 + 30).
    const missed = await api.submitAttempt(run.id, { question_id: q4, selected_answer: wrongOption(q4), attempt_id: 'a0' })
    expect(missed.player_hp_remaining).toBe(run.player_hp - 10)
    let last = missed
    for (const [i, qid] of [q1, q2, q3, q1].entries()) {
      last = await api.submitAttempt(run.id, { question_id: qid, selected_answer: answerKey[qid].correct, attempt_id: `a${i + 1}` })
    }
    expect(last.monster_hp_remaining).toBe(0)
    // q4 is due: a wrong answer now costs 10 HP and leaves the monster at 0.
    const wrong = await api.submitAttempt(run.id, { question_id: q4, selected_answer: wrongOption(q4), attempt_id: 'r1' })
    expect(wrong.correct).toBe(false)
    expect(wrong.monster_hp_remaining).toBe(0)
    expect(wrong.player_hp_remaining).toBe(last.player_hp_remaining - 10)
    // A correct answer lays it to rest: no damage, the monster stays at 0, and it is no longer due.
    const right = await api.submitAttempt(run.id, { question_id: q4, selected_answer: answerKey[q4].correct, attempt_id: 'r2' })
    expect(right.correct).toBe(true)
    expect(right.damage_dealt).toBe(0)
    expect(right.monster_hp_remaining).toBe(0)
    expect(right.is_critical).toBe(false)
    expect(await api.getDueReviews(dungeon.id)).toEqual([])
    // Not due and the monster is defeated: still refused.
    await expect(
      api.submitAttempt(run.id, { question_id: q1, selected_answer: answerKey[q1].correct, attempt_id: 'r3' }),
    ).rejects.toMatchObject({ status: 409 })
  })
})
