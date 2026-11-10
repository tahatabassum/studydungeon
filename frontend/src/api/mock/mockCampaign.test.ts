import { describe, expect, it } from 'vitest'
import type { ApiClient } from '../ApiClient'
import { dungeonSchema } from '../schemas'
import { ApiError } from '../errors'
import { answerKey } from './answerKey'
import { createMockAdapter } from './mockAdapter'

const DUNGEON = 'demo-dungeon'
let n = 0
const id = (): string => `a-${(n += 1)}`

async function strikeRoom(api: ApiClient, runId: string, roomId: string, questionIds: string[]): Promise<void> {
  let guard = 0
  for (;;) {
    const qid = questionIds[guard++ % questionIds.length]
    const r = await api.submitAttempt(runId, { question_id: qid, selected_answer: answerKey[qid].correct, attempt_id: id() })
    if (r.monster_hp_remaining === 0) break
    if (guard > 40) throw new Error('monster did not die')
  }
  await api.clearRoom(runId, roomId)
}

describe('mock campaign: floors (D13)', () => {
  it('serves exactly 2 floors plus the Final_Boss, with the right rooms and bosses', async () => {
    const api = createMockAdapter()
    const d = await api.getDungeon(DUNGEON)
    expect(dungeonSchema.safeParse(d).success).toBe(true)
    expect(d.floors).toHaveLength(2)
    expect(d.floors!.map((f) => [f.index, f.title, f.room_ids])).toEqual([
      [1, 'The Entry Crypt', ['room-1', 'room-2']],
      [2, 'The Alchemy Wing', ['room-3', 'room-4']],
    ])
    expect(d.floors!.map((f) => f.boss.name)).toEqual(['Toxic Slime', 'Memory Eater'])
    expect(d.floors!.map((f) => f.status)).toEqual(['ready', 'locked'])
    expect(d.final_boss).toMatchObject({ name: 'The Exam Warden', hp: 220, unlocked: false })
    expect(d.rooms.find((r) => r.id === 'room-3')?.floor_id).toBe('floor-2')
    expect(d.rooms.find((r) => r.id === 'room-5')?.floor_id).toBeUndefined()
  })

  it('a locked floor cannot be started; a ready floor scopes the run and returns mode and seed', async () => {
    const api = createMockAdapter()
    await expect(api.startRun({ dungeon_id: DUNGEON, floor_id: 'floor-2', mode: 'floor' })).rejects.toMatchObject({
      status: 409,
      code: 'FLOOR_LOCKED',
    })
    const run = await api.startRun({ dungeon_id: DUNGEON, floor_id: 'floor-1', mode: 'floor' })
    expect(run).toMatchObject({ mode: 'floor', current_room_id: 'room-1', monster_hp: 80 })
    expect(typeof run.run_seed).toBe('string')
    // A question from another floor is rejected.
    await expect(
      api.submitAttempt(run.id, { question_id: 'n1', selected_answer: 'x', attempt_id: id() }),
    ).rejects.toMatchObject({ code: 'OUT_OF_SCOPE' })
  })

  it('clearing a floor boss clears the floor, unlocks the next, and finishing returns rank, mastery and chest', async () => {
    const api = createMockAdapter()
    const d = await api.getDungeon(DUNGEON)
    const run = await api.startRun({ dungeon_id: DUNGEON, floor_id: 'floor-1', mode: 'floor' })
    await expect(api.finishRun(run.id)).rejects.toMatchObject({ status: 409 })
    for (const rid of ['room-1', 'room-2']) {
      const room = d.rooms.find((r) => r.id === rid)!
      await strikeRoom(api, run.id, rid, room.monster.question_ids)
    }
    const summary = await api.finishRun(run.id)
    expect(summary.floor_rank).toBe('S')
    expect(summary.mastery_by_topic?.map((m) => m.topic_id)).toEqual(['room-1', 'room-2'])
    expect(summary.mastery_by_topic?.every((m) => m.mastery >= 50)).toBe(true)
    expect(summary.chest_rewards?.length).toBeGreaterThan(0)
    const after = await api.getDungeon(DUNGEON)
    expect(after.floors!.map((f) => [f.status, f.rank])).toEqual([
      ['cleared', 'S'],
      ['ready', null],
    ])
    expect((await api.getGenerationStatus(DUNGEON)).floors.map((f) => f.status)).toEqual(['cleared', 'ready'])
  })

  it('a missed question returns once as a second chance with half damage and a requeue hint', async () => {
    const api = createMockAdapter()
    const run = await api.startRun({ dungeon_id: DUNGEON, floor_id: 'floor-1', mode: 'floor' })
    const wrong = await api.submitAttempt(run.id, { question_id: 'q1', selected_answer: 'nope', attempt_id: id() })
    expect(wrong.correct).toBe(false)
    expect(wrong.requeue_after).toBeGreaterThanOrEqual(0)
    expect(wrong.is_retry).toBe(false)
    expect(wrong.correct_answer).toBe(answerKey.q1.correct)
    const retry = await api.submitAttempt(run.id, { question_id: 'q1', selected_answer: answerKey.q1.correct, attempt_id: id() })
    expect(retry).toMatchObject({ correct: true, is_retry: true, retry_multiplier: 0.5, damage_dealt: 10 })
    expect(retry.correct_answer).toBeUndefined()
  })

  it('legacy startRun(dungeonId) is unchanged: no mode, no retry fields', async () => {
    const api = createMockAdapter()
    const run = await api.startRun(DUNGEON)
    expect(run.mode).toBeUndefined()
    const r = await api.submitAttempt(run.id, { question_id: 'q1', selected_answer: 'nope', attempt_id: id() })
    expect(r.is_retry).toBeUndefined()
    expect(r.requeue_after).toBeUndefined()
  })

  it('retryFloor only works on a failed floor', async () => {
    const api = createMockAdapter({ failedFloorIds: ['floor-1'] })
    expect((await api.getGenerationStatus(DUNGEON)).floors[0].status).toBe('failed')
    await expect(api.startRun({ dungeon_id: DUNGEON, floor_id: 'floor-1', mode: 'floor' })).rejects.toBeInstanceOf(ApiError)
    await api.retryFloor('floor-1')
    expect((await api.getGenerationStatus(DUNGEON)).floors[0].status).toBe('ready')
    await expect(api.retryFloor('floor-1')).rejects.toMatchObject({ code: 'FLOOR_NOT_FAILED' })
    await expect(api.retryFloor('nope')).rejects.toMatchObject({ status: 404 })
  })
})

describe('mock campaign: due reviews', () => {
  it('without an argument returns the new shape; with a dungeon id the old bare array', async () => {
    let now = Date.parse('2026-02-01T10:00:00Z')
    const api = createMockAdapter({ now: () => now })
    const run = await api.startRun(DUNGEON)
    await api.submitAttempt(run.id, { question_id: 'q1', selected_answer: 'nope', attempt_id: id() })
    await api.submitAttempt(run.id, { question_id: 'q2', selected_answer: answerKey.q2.correct, attempt_id: id() })
    const summary = await api.getDueReviews()
    expect(summary).toMatchObject({ due_count: 1, daily_streak: 0 })
    expect(summary.items.map((i) => i.question.id)).toEqual(['q1'])
    expect(summary.next_due_at).toBe(new Date(now + 24 * 3600 * 1000).toISOString())
    const legacy = await api.getDueReviews(DUNGEON)
    expect(Array.isArray(legacy)).toBe(true)
    expect(legacy).toHaveLength(1)
    now += 1
  })

  it('a daily haunt run carries the due items and finishing it raises the daily streak', async () => {
    const api = createMockAdapter({ seedRevenants: true })
    const run = await api.startRun({ dungeon_id: DUNGEON, floor_id: null, mode: 'daily_haunt' })
    expect(run.mode).toBe('daily_haunt')
    expect(run.revenants?.length).toBeGreaterThan(0)
    expect(run.revenants!.length).toBeLessThanOrEqual(8)
    await api.finishRun(run.id)
    expect((await api.getDueReviews()).daily_streak).toBe(1)
  })
})
