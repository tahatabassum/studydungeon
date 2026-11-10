import { withFloors } from '../api/floorMapping'
import type { Dungeon, Floor } from '../types/api'

/** What the campaign map can start: a Floor or the Final_Boss. */
export interface PlayableFloor {
  /** The id sent as `floor_id` (a Floor id, or the Final_Boss id). */
  id: string
  title: string
  kind: 'floor' | 'final'
  floor?: Floor
}

/** The dungeon as the map sees it: always at least the legacy Floor when there are rooms (D17). */
export function campaignView(dungeon: Dungeon): Dungeon {
  return withFloors(dungeon)
}

/**
 * The dungeon reduced to the rooms a practice run (Weak Topics, Exam) covers, as the Backend listed them.
 * Rooms keep their ids and flags, are renumbered 1..n in dungeon order, and only the questions of those rooms
 * stay. The caller treats the last room as the end of the run. Returns null when none of the ids is a room. Pure.
 */
export function practiceDungeon(dungeon: Dungeon, roomIds: readonly string[]): Dungeon | null {
  const wanted = new Set(roomIds)
  const picked = dungeon.rooms.filter((r) => wanted.has(r.id)).sort((a, b) => a.order - b.order)
  if (picked.length === 0) return null
  const rooms = picked.map((r, i) => ({ ...r, order: i + 1 }))
  const questionIds = new Set(rooms.flatMap((r) => r.monster.question_ids))
  return { ...dungeon, rooms, questions: dungeon.questions.filter((q) => questionIds.has(q.id)) }
}

/**
 * The dungeon reduced to ONE Floor (or the Final_Boss), ready for the existing play experience.
 * Rooms keep their ids (the Backend knows them), are renumbered 1..n so "Room X of Y" counts inside
 * the Floor, and only the last room is the boss: it holds the Floor_Boss, so it has no exit gate and
 * clearing it finishes the run. Returns null when the id is not a Floor or the Final_Boss.
 * Pure.
 */
export function floorDungeon(dungeon: Dungeon, floorId: string): Dungeon | null {
  const view = campaignView(dungeon)
  const byId = new Map(view.rooms.map((r) => [r.id, r]))
  const floor = view.floors?.find((f) => f.id === floorId)
  let ids: string[]
  if (floor) {
    ids = floor.room_ids
  } else if (view.final_boss && view.final_boss.id === floorId) {
    ids = view.rooms.filter((r) => r.monster.id === floorId).map((r) => r.id)
  } else {
    return null
  }
  const picked = ids.flatMap((id) => {
    const room = byId.get(id)
    return room ? [room] : []
  })
  if (picked.length === 0) return null
  picked.sort((a, b) => a.order - b.order)
  const rooms = picked.map((r, i) => ({ ...r, order: i + 1, is_boss: i === picked.length - 1 }))
  const wanted = new Set(rooms.flatMap((r) => r.monster.question_ids))
  return { ...view, rooms, questions: view.questions.filter((q) => wanted.has(q.id)) }
}
