/**
 * An uploaded notes file becomes a dungeon the mock can run end to end: upload, summon, open the map,
 * start a floor, answer to clear it, finish, then the final boss. The rules are the shared ones.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '../errors'
import { KNOWN_KINDS } from '../wire/kinds'
import { createMockAdapter } from './mockAdapter'
import demoDungeon from '../../demo/demoDungeon.json'
import type { ApiClient } from '../ApiClient'
import type { Dungeon, Room } from '../../types/api'

const notes = (name: string) => new File(['a'.repeat(900)], name, { type: 'text/plain' })

/** The synthetic key rotates through the options by the number in `<room>-q<n>`. */
function correctFor(room: Room, questionId: string, dungeon: Dungeon): string {
  const q = dungeon.questions.find((x) => x.id === questionId)
  if (!q) throw new Error(`no question ${questionId}`)
  const n = Number(questionId.slice(questionId.lastIndexOf('-q') + 2))
  expect(room.monster.question_ids).toContain(questionId)
  return q.options[(n - 1) % q.options.length]
}

let attempt = 0
async function clearRoomByAnswering(api: ApiClient, runId: string, room: Room, dungeon: Dungeon): Promise<void> {
  for (const qid of room.monster.question_ids) {
    const result = await api.submitAttempt(runId, {
      question_id: qid,
      selected_answer: correctFor(room, qid, dungeon),
      attempt_id: `a-${(attempt += 1)}`,
    })
    expect(result.correct).toBe(true)
    if (result.monster_hp_remaining === 0) break
  }
  await api.clearRoom(runId, room.id)
}

async function summon(api: ApiClient): Promise<Dungeon> {
  await api.register({ username: 'gen_player', password: 'correct-horse-9' })
  const sent = await api.uploadDocument(notes('Cell biology.txt'))
  expect((await api.getDocumentStatus(sent.id)).status).toBe('accepted')
  const created = await api.generateDungeon(sent.id)
  return api.getDungeon(created.id)
}

describe('mock: a generated dungeon is playable', () => {
  it('has rooms, existing monster kinds, a key for every question, floors and a final boss', async () => {
    const api = createMockAdapter({ upload: { processingMs: 0, stepMs: 0 } })
    const map = await summon(api)
    expect(map.floors?.length).toBeGreaterThanOrEqual(2)
    expect(map.floors?.[0].status).toBe('ready')
    expect(map.final_boss?.unlocked).toBe(false)
    const kinds: readonly string[] = KNOWN_KINDS
    for (const room of map.rooms) {
      expect(kinds).toContain(room.monster.kind)
      expect(room.monster.question_ids.length).toBeGreaterThanOrEqual(15)
    }
    expect(map.rooms[map.rooms.length - 1].is_boss).toBe(true)
    expect(map.questions.every((q) => q.prompt.startsWith('Sample question'))).toBe(true)
    // Questions never carry the answer.
    expect(JSON.stringify(map.questions)).not.toContain('correct')
  })

  it('upload, summon, map, floor 1, answer to clear, finish, then every floor and the final boss', async () => {
    const api = createMockAdapter({ upload: { processingMs: 0, stepMs: 0 } })
    const map = await summon(api)
    const floors = map.floors ?? []
    const byId = new Map(map.rooms.map((r) => [r.id, r]))

    // Floor 1.
    const run = await api.startRun({ dungeon_id: map.id, floor_id: floors[0].id, mode: 'floor' })
    expect(run.dungeon_id).toBe(map.id)
    expect(run.current_room_id).toBe(floors[0].room_ids[0])
    expect(run.player_hp).toBeGreaterThan(0)
    // The run reads back, and a finish before the boss is refused.
    expect((await api.getRun(run.id)).current_room_id).toBe(floors[0].room_ids[0])
    await expect(api.finishRun(run.id)).rejects.toMatchObject({ code: 'BOSS_NOT_CLEARED' })
    for (const rid of floors[0].room_ids) await clearRoomByAnswering(api, run.id, byId.get(rid)!, map)
    const summary = await api.finishRun(run.id)
    expect(summary.accuracy).toBe(1)
    expect(summary.floor_rank).toBeTruthy()

    const after = await api.getDungeon(map.id)
    expect(after.floors?.[0].status).toBe('cleared')
    expect(after.floors?.[0].rank).toBe(summary.floor_rank)
    const status = await api.getGenerationStatus(map.id)
    expect(status.floors[0].status).toBe('cleared')
    expect(after.final_boss?.unlocked).toBe(false)
    await expect(api.startRun({ dungeon_id: map.id, floor_id: after.final_boss!.id, mode: 'floor' })).rejects.toBeInstanceOf(ApiError)

    // The remaining floors, then the final boss opens and can be beaten.
    for (const floor of floors.slice(1)) {
      const r = await api.startRun({ dungeon_id: map.id, floor_id: floor.id, mode: 'floor' })
      for (const rid of floor.room_ids) await clearRoomByAnswering(api, r.id, byId.get(rid)!, map)
      await api.finishRun(r.id)
    }
    const ready = await api.getDungeon(map.id)
    expect(ready.final_boss?.unlocked).toBe(true)
    const boss = await api.startRun({ dungeon_id: map.id, floor_id: ready.final_boss!.id, mode: 'floor' })
    const finalRoom = map.rooms[map.rooms.length - 1]
    await clearRoomByAnswering(api, boss.id, finalRoom, map)
    expect((await api.finishRun(boss.id)).correct).toBeGreaterThan(0)
  })

  it('a wrong answer costs health and the demo dungeon still works beside it', async () => {
    const api = createMockAdapter({ upload: { processingMs: 0, stepMs: 0 } })
    const map = await summon(api)
    const floor = map.floors![0]
    const room = map.rooms.find((r) => r.id === floor.room_ids[0])!
    const run = await api.startRun({ dungeon_id: map.id, floor_id: floor.id, mode: 'floor' })
    const qid = room.monster.question_ids[0]
    const wrongOption = map.questions.find((q) => q.id === qid)!.options.find((o) => o !== correctFor(room, qid, map))!
    const result = await api.submitAttempt(run.id, { question_id: qid, selected_answer: wrongOption, attempt_id: 'w1' })
    expect(result.correct).toBe(false)
    expect(result.player_hp_remaining).toBeLessThan(run.player_hp)

    const demo = await api.startRun(demoDungeon.id)
    expect(demo.dungeon_id).toBe(demoDungeon.id)
  })

  it('refuses a floor that is still being summoned', async () => {
    const api = createMockAdapter({ upload: { processingMs: 0, stepMs: 60_000 } })
    const map = await summon(api)
    const last = map.floors![map.floors!.length - 1]
    await expect(api.startRun({ dungeon_id: map.id, floor_id: last.id, mode: 'floor' })).rejects.toMatchObject({
      status: 409,
    })
  })
})
