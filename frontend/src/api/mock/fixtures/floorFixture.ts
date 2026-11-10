import type { Dungeon, FinalBoss, Floor, FloorRank, FloorStatus, Question, Room } from '../../../types/api'
import { syntheticPool } from '../pool'

/**
 * Test and DEV-route fixtures only (D11). They are never reachable in a production build:
 * the only importer outside tests is the lazily registered `/dev/floors` route.
 */
export type FixtureStatusMode = 'mixed' | FloorStatus
export const FIXTURE_FLOOR_COUNTS = [1, 3, 10, 25] as const
export type FixtureFloorCount = (typeof FIXTURE_FLOOR_COUNTS)[number]

const RANKS: FloorRank[] = ['S', 'A', 'B', 'C']

/** Deterministic mixed statuses: a cleared run, then ready, generating, (failed for 10+ floors), then locked. */
export function mixedStatus(index0: number, count: number): FloorStatus {
  const cleared = Math.floor(count / 4)
  if (index0 < cleared) return 'cleared'
  if (index0 === cleared) return 'ready'
  if (index0 === cleared + 1) return 'generating'
  if (index0 === cleared + 2 && count >= 10) return 'failed'
  return 'locked'
}

export interface FloorFixture {
  dungeon: Dungeon
  floors: Floor[]
  final_boss: FinalBoss
}

/** Builds a dungeon with `count` Floors of two topics each (the second room is the Floor_Boss), plus a Final_Boss. */
export function buildFloorFixture(count: number, mode: FixtureStatusMode = 'mixed'): FloorFixture {
  const rooms: Room[] = []
  const questions: Question[] = []
  const floors: Floor[] = []
  let order = 0

  const addRoom = (id: string, label: string, monsterName: string, hp: number, isBoss: boolean, floorId?: string): Room => {
    const pool = syntheticPool(id, label)
    questions.push(...pool)
    order += 1
    const room: Room = {
      id,
      label,
      order,
      is_boss: isBoss,
      ...(floorId ? { floor_id: floorId } : {}),
      monster: { id: `monster-${id}`, name: monsterName, max_hp: hp, question_ids: pool.map((q) => q.id), kind: 'unknown' },
    }
    rooms.push(room)
    return room
  }

  for (let i = 0; i < count; i += 1) {
    const n = i + 1
    const floorId = `floor-${n}`
    const status = mode === 'mixed' ? mixedStatus(i, count) : mode
    const topicRoom = addRoom(`f${n}-topic`, `Floor ${n} Topic`, `Guardian ${n}`, 80, false, floorId)
    const bossRoom = addRoom(`f${n}-boss`, `Floor ${n} Boss`, `Warden ${n}`, 90, false, floorId)
    floors.push({
      id: floorId,
      index: n,
      title: `Floor ${n}`,
      status,
      topics: [topicRoom, bossRoom].map((r) => ({ id: r.id, title: r.label, mastery: status === 'cleared' ? 70 + (i % 4) * 7 : 0 })),
      boss: { id: bossRoom.monster.id, name: bossRoom.monster.name, hp: bossRoom.monster.max_hp, kind: 'unknown' },
      rank: status === 'cleared' ? RANKS[i % RANKS.length] : null,
      room_ids: [topicRoom.id, bossRoom.id],
    })
  }

  const finalRoom = addRoom('final-boss', 'Final Exam', 'The Exam Warden', 220, true)
  const final_boss: FinalBoss = {
    id: finalRoom.monster.id,
    name: finalRoom.monster.name,
    hp: finalRoom.monster.max_hp,
    unlocked: floors.length > 0 && floors.every((f) => f.status === 'cleared'),
  }
  const dungeon: Dungeon = { id: `fixture-${count}`, name: `Fixture dungeon (${count} floors)`, rooms, questions, floors, final_boss }
  return { dungeon, floors, final_boss }
}
