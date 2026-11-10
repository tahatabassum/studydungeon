import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../ApiClient'
import { answerKey } from './answerKey'
import { createMockAdapter } from './mockAdapter'

const DUNGEON = 'demo-dungeon'
let n = 0
const id = (): string => `m-${(n += 1)}`

async function firstQuestion(api: ApiClient, roomId: string): Promise<string> {
  const d = await api.getDungeon(DUNGEON)
  return d.rooms.find((r) => r.id === roomId)!.monster.question_ids[0]
}

describe('mock run modes (frontend-08 Phase 3)', () => {
  it('weak_topics picks the lowest-mastery topics and tells the client which rooms', async () => {
    const api = createMockAdapter()
    // Practice room-1 and room-2 on a floor run so their mastery rises above the untouched topics.
    const floor = await api.startRun({ dungeon_id: DUNGEON, floor_id: 'floor-1', mode: 'floor' })
    for (const rid of ['room-1', 'room-2']) {
      const qid = await firstQuestion(api, rid)
      await api.submitAttempt(floor.id, { question_id: qid, selected_answer: answerKey[qid].correct, attempt_id: id() })
    }
    const run = await api.startRun({ dungeon_id: DUNGEON, floor_id: null, mode: 'weak_topics' })
    expect(run).toMatchObject({ mode: 'weak_topics', room_ids: ['room-3', 'room-4'], current_room_id: 'room-3' })
    // Another topic is out of scope, and a floor boss is not needed to finish.
    const out = await firstQuestion(api, 'room-1')
    await expect(
      api.submitAttempt(run.id, { question_id: out, selected_answer: answerKey[out].correct, attempt_id: id() }),
    ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' })
    const ok = await firstQuestion(api, 'room-3')
    await api.submitAttempt(run.id, { question_id: ok, selected_answer: answerKey[ok].correct, attempt_id: id() })
    const summary = await api.finishRun(run.id)
    expect(summary.mastery_by_topic?.map((m) => m.topic_id)).toEqual(['room-3', 'room-4'])
    expect(summary.floor_rank).toBeUndefined()
  })

  it('practice runs never clear a floor, even when their rooms are defeated', async () => {
    const api = createMockAdapter()
    const run = await api.startRun({ dungeon_id: DUNGEON, floor_id: null, mode: 'weak_topics' })
    expect(run.room_ids).toEqual(['room-1', 'room-2'])
    const d = await api.getDungeon(DUNGEON)
    for (const rid of ['room-1', 'room-2']) {
      const qids = d.rooms.find((r) => r.id === rid)!.monster.question_ids
      for (let i = 0; i < 20; i += 1) {
        const qid = qids[i % qids.length]
        const r = await api.submitAttempt(run.id, { question_id: qid, selected_answer: answerKey[qid].correct, attempt_id: id() })
        if (r.monster_hp_remaining === 0) break
      }
      await api.clearRoom(run.id, rid)
    }
    await api.finishRun(run.id)
    expect((await api.getDungeon(DUNGEON)).floors!.map((f) => f.status)).toEqual(['ready', 'locked'])
  })

  it('exam covers every topic in order and can end before the boss', async () => {
    const api = createMockAdapter()
    const run = await api.startRun({ dungeon_id: DUNGEON, floor_id: null, mode: 'exam' })
    expect(run).toMatchObject({ mode: 'exam', room_ids: ['room-1', 'room-2', 'room-3', 'room-4', 'room-5'] })
    const summary = await api.finishRun(run.id)
    expect(summary.mastery_by_topic).toHaveLength(5)
  })

  it('replay_floor needs a cleared floor', async () => {
    const api = createMockAdapter()
    await expect(api.startRun({ dungeon_id: DUNGEON, floor_id: 'floor-1', mode: 'replay_floor' })).rejects.toMatchObject({
      status: 409,
      code: 'FLOOR_NOT_CLEARED',
    })
    await expect(api.startRun({ dungeon_id: DUNGEON, floor_id: null, mode: 'replay_floor' })).rejects.toMatchObject({ status: 422 })
  })

  it('a daily haunt accepts only due items, costs no health on a miss and rests a memory on a hit', async () => {
    const api = createMockAdapter({ seedRevenants: true })
    const before = await api.getDueReviews()
    const run = await api.startRun({ dungeon_id: DUNGEON, floor_id: null, mode: 'daily_haunt' })
    expect(run.monster_hp).toBe(0)
    expect(run.room_ids).toBeUndefined()
    const item = run.revenants![0]
    // Not a due question: refused. (Boss questions are never seeded.)
    const bossQuestion = await firstQuestion(api, 'room-5')
    await expect(
      api.submitAttempt(run.id, { question_id: bossQuestion, selected_answer: 'x', attempt_id: id() }),
    ).rejects.toMatchObject({ code: 'NOT_DUE' })
    const miss = await api.submitAttempt(run.id, { question_id: item.question.id, selected_answer: 'nope', attempt_id: id() })
    expect(miss).toMatchObject({ correct: false, player_hp_remaining: 100, monster_hp_remaining: 0 })
    const hit = await api.submitAttempt(run.id, {
      question_id: item.question.id,
      selected_answer: answerKey[item.question.id].correct,
      attempt_id: id(),
    })
    expect(hit).toMatchObject({ correct: true, damage_dealt: 0 })
    expect((await api.getDueReviews()).due_count).toBe(before.due_count - 1)
  })
})
