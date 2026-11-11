import { describe, expect, it } from 'vitest'
import { createMockAdapter } from './mockAdapter'
import { answerKey } from './answerKey'
import { POINTS, createMockPoints, weekOf } from './mockPoints'
import type { ApiClient } from '../ApiClient'
import type { Dungeon } from '../../types/api'

let attemptSeq = 0

/** Answers correctly until the monster of `roomId` is dead. Works for the demo and for generated pack dungeons. */
async function killRoom(api: ApiClient, runId: string, dungeon: Dungeon, roomId: string): Promise<void> {
  const room = dungeon.rooms.find((r) => r.id === roomId)!
  const ids = room.monster.question_ids
  for (let i = 0; i < ids.length * 2; i += 1) {
    const qid = ids[i % ids.length]
    const q = dungeon.questions.find((x) => x.id === qid)!
    const correct = answerKey[qid]?.correct ?? q.options[(i % ids.length) % q.options.length]
    attemptSeq += 1
    const res = await api.submitAttempt(runId, { attempt_id: `t-${attemptSeq}`, question_id: qid, selected_answer: correct })
    if (res.monster_hp_remaining <= 0) return
  }
  throw new Error('monster did not fall')
}

async function clearPack(api: ApiClient, dungeonId: string, finalRoomId: string) {
  const dungeon = await api.getDungeon(dungeonId)
  const run = await api.startRun(dungeonId)
  await killRoom(api, run.id, dungeon, finalRoomId)
  const clear = await api.clearRoom(run.id, finalRoomId)
  const summary = await api.finishRun(run.id)
  return { clear, summary, run }
}

async function newApi(): Promise<ApiClient> {
  const api = createMockAdapter()
  await api.startDemoSession()
  return api
}

describe('mock packs (frontend-10 task 5.3)', () => {
  it('serves three packs: Pack 1 the demo, Packs 2 and 3 sample content, only Pack 1 open', async () => {
    const api = await newApi()
    const res = await api.getPacks()
    expect(res.packs.map((p) => [p.id, p.order, p.status])).toEqual([
      ['pack-1', 1, 'available'],
      ['pack-2', 2, 'locked'],
      ['pack-3', 3, 'locked'],
    ])
    expect(res.packs[0].dungeon_id).toBe('demo-dungeon')
    expect(res.packs[0].sample).toBeUndefined()
    expect(res.packs.slice(1).map((p) => [p.title, p.sample])).toEqual([
      ['Sample Pack 2', true],
      ['Sample Pack 3', true],
    ])
    expect(res.next_pack_id).toBe('pack-1')
    expect(res.all_completed).toBe(false)
  })

  it('needs a session', async () => {
    await expect(createMockAdapter().getPacks()).rejects.toMatchObject({ status: 401 })
  })

  it('rejects a run on a locked pack with 403 PACK_LOCKED', async () => {
    const api = await newApi()
    const locked = (await api.getPacks()).packs[1]
    await expect(api.startRun(locked.dungeon_id)).rejects.toMatchObject({ status: 403, code: 'PACK_LOCKED' })
  })

  it('keeps pack dungeons out of the player dungeon list', async () => {
    const api = await newApi()
    const ids = (await api.listDungeons()).map((d) => d.id)
    expect(ids).toEqual(['demo-dungeon'])
  })

  it('unlocks Pack 2 when the final boss of Pack 1 is cleared, with points and pack_progress', async () => {
    const api = await newApi()
    const { clear, summary } = await clearPack(api, 'demo-dungeon', 'room-5')
    expect(clear).toMatchObject({ points_awarded: POINTS.bossClear, points_reason: 'boss_clear' })
    expect(summary.pack_progress).toEqual({ pack_id: 'pack-1', status: 'completed', unlocked_pack_id: 'pack-2', all_completed: false })
    expect(summary.points_earned).toBeGreaterThanOrEqual(POINTS.bossClear + POINTS.packComplete)
    expect(summary.player_points?.overall).toBe(summary.player_points?.preloaded)
    const res = await api.getPacks()
    expect(res.packs.map((p) => p.status)).toEqual(['completed', 'available', 'locked'])
    expect(res.packs[0].points_earned).toBe(summary.points_earned)
    expect(res.next_pack_id).toBe('pack-2')
    const run2 = await api.startRun(res.packs[1].dungeon_id)
    expect(run2.dungeon_id).toBe(res.packs[1].dungeon_id)
  })

  it('plays a sample pack to its end and completes every pack', async () => {
    const api = await newApi()
    await clearPack(api, 'demo-dungeon', 'room-5')
    const p2 = (await api.getPacks()).packs[1]
    const second = await clearPack(api, p2.dungeon_id, `${p2.dungeon_id}-final`)
    expect(second.summary.pack_progress).toMatchObject({ pack_id: 'pack-2', unlocked_pack_id: 'pack-3', all_completed: false })
    const p3 = (await api.getPacks()).packs[2]
    const third = await clearPack(api, p3.dungeon_id, `${p3.dungeon_id}-final`)
    expect(third.summary.pack_progress).toMatchObject({ pack_id: 'pack-3', unlocked_pack_id: null, all_completed: true })
    const res = await api.getPacks()
    expect(res.all_completed).toBe(true)
    expect(res.next_pack_id).toBeNull()
  })

  it('resets packs and points on delete account', async () => {
    const api = await newApi()
    await clearPack(api, 'demo-dungeon', 'room-5')
    await api.deleteAccount()
    await api.startDemoSession()
    expect((await api.getPacks()).packs.map((p) => p.status)).toEqual(['available', 'locked', 'locked'])
  })
})

describe('mock points (frontend-10 task 5.3)', () => {
  const base = { hard: false, isRetry: false, practice: false, board: 'preloaded' as const }

  it('pays the first correct answer once per question and week, then the repeat rate', () => {
    const p = createMockPoints(() => 0)
    expect(p.attempt({ ...base, attemptId: 'a1', questionId: 'q', correct: true })).toMatchObject({ points_awarded: 100, points_reason: 'first_correct' })
    expect(p.attempt({ ...base, attemptId: 'a2', questionId: 'q', correct: true })).toMatchObject({ points_awarded: 10, points_reason: 'repeat_correct' })
    expect(p.attempt({ ...base, attemptId: 'a3', questionId: 'h', correct: true, hard: true }).points_awarded).toBe(150)
  })

  it('pays the first correct answer again in a new week', () => {
    let t = 0
    const p = createMockPoints(() => t)
    p.attempt({ ...base, attemptId: 'a1', questionId: 'q', correct: true })
    t = 8 * 24 * 60 * 60 * 1000
    expect(weekOf(t)).toBeGreaterThan(weekOf(0))
    expect(p.attempt({ ...base, attemptId: 'a2', questionId: 'q', correct: true }).points_awarded).toBe(100)
  })

  it('pays half for a retry and for practice modes, nothing for a wrong answer', () => {
    const p = createMockPoints(() => 0)
    expect(p.attempt({ ...base, attemptId: 'r', questionId: 'q1', correct: true, isRetry: true })).toMatchObject({ points_awarded: 50, points_reason: 'retry' })
    expect(p.attempt({ ...base, attemptId: 'p', questionId: 'q2', correct: true, practice: true })).toMatchObject({ points_awarded: 50, points_reason: 'practice' })
    expect(p.attempt({ ...base, attemptId: 'w', questionId: 'q3', correct: false })).toMatchObject({ points_awarded: 0, points_reason: 'wrong' })
  })

  it('is idempotent per attempt_id and per clear', () => {
    const p = createMockPoints(() => 0)
    p.attempt({ ...base, attemptId: 'a1', questionId: 'q', correct: true })
    const again = p.attempt({ ...base, attemptId: 'a1', questionId: 'q', correct: true })
    expect(again.points_awarded).toBe(100)
    expect(p.totals().overall).toBe(100)
    p.clear({ clearId: 'c', boss: false, practice: false, board: 'preloaded' })
    p.clear({ clearId: 'c', boss: false, practice: false, board: 'preloaded' })
    expect(p.totals().overall).toBe(150)
    expect(p.packComplete('pack-1', 'preloaded')).toBe(POINTS.packComplete)
    expect(p.packComplete('pack-1', 'preloaded')).toBe(0)
  })

  it('pays room 50, boss 200 and splits totals by board', () => {
    const p = createMockPoints(() => 0)
    expect(p.clear({ clearId: 'r', boss: false, practice: false, board: 'own_notes' })).toMatchObject({ points_awarded: 50, points_reason: 'room_clear' })
    expect(p.clear({ clearId: 'b', boss: true, practice: false, board: 'preloaded' })).toMatchObject({ points_awarded: 200, points_reason: 'boss_clear' })
    expect(p.totals()).toEqual({ preloaded: 200, own_notes: 50, overall: 250 })
  })

  it('attaches points to a real mock attempt', async () => {
    const api = await newApi()
    const run = await api.startRun('demo-dungeon')
    const first = await api.submitAttempt(run.id, { attempt_id: 'x1', question_id: 'b1', selected_answer: answerKey.b1.correct })
    expect(first).toMatchObject({ points_awarded: 100, points_reason: 'first_correct' })
    expect(first.player_points).toMatchObject({ preloaded: 100, overall: 100 })
    const wrong = await api.submitAttempt(run.id, { attempt_id: 'x2', question_id: 'b3', selected_answer: '__wrong__' })
    expect(wrong).toMatchObject({ points_awarded: 0, points_reason: 'wrong' })
  })
})
