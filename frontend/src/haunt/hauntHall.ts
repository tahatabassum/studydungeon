import type { RevenantSpawn } from '@/game/events'
import { MAX_REVENANTS_PER_ROOM, REVENANT_KIND } from '@/encounter/revenants'
import type { Dungeon, DueReview, Room } from '@/types/api'

/**
 * The Haunted Hall: how a Daily Haunt is shown. Every due item is one Revenant. The items are split into
 * display-only halls of at most 3 ghosts (what one room can show). A hall has a monster with 0 HP, so the
 * scene shows no monster, and its gate opens when every ghost in it is laid to rest. The ids below are
 * display-only: the Backend never sees them. Pure.
 */
export const HALL_CAPACITY = MAX_REVENANTS_PER_ROOM

/** Names of the halls, in order; further halls are numbered. */
const HALL_NAMES = ['Gallery of Echoes', 'Candle Cloister', 'Vigil Chamber', 'Hall of Quiet Names'] as const

export function hallName(index: number): string {
  return index < HALL_NAMES.length ? HALL_NAMES[index] : `Hall of Whispers ${index + 1}`
}

export interface Hall {
  /** The display-only dungeon the scene loads (hall rooms, no real monsters). */
  dungeon: Dungeon
  /** The due items, each pointing at its hall room. */
  reviews: DueReview[]
  /** Revenants to show per hall room id. */
  spawnsByRoom: Readonly<Record<string, RevenantSpawn[]>>
  /** Hall room ids in order. */
  roomIds: string[]
  /** Number of items (ghosts). */
  total: number
}

/** Number of halls needed for `count` items. */
export function hallCount(count: number): number {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  return Math.ceil(n / HALL_CAPACITY)
}

/**
 * Builds the hall for the due items received, or null when there are none. Items keep their order and
 * duplicates (same id) are dropped. Never trims the list: every item received becomes a ghost.
 */
export function buildHall(dungeonId: string, items: readonly DueReview[]): Hall | null {
  const seen = new Set<string>()
  const unique = items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
  if (unique.length === 0) return null
  const rooms: Room[] = []
  const reviews: DueReview[] = []
  const spawnsByRoom: Record<string, RevenantSpawn[]> = {}
  for (let k = 0; k < hallCount(unique.length); k += 1) {
    const roomId = `hall-${k + 1}`
    rooms.push({
      id: roomId,
      label: hallName(k),
      order: k + 1,
      is_boss: false,
      // 0 HP: no monster stands in a hall (the scene retires it at once).
      monster: { id: `${roomId}-void`, name: 'Haunted Hall', max_hp: 0, question_ids: [], kind: REVENANT_KIND },
    })
    const slice = unique.slice(k * HALL_CAPACITY, (k + 1) * HALL_CAPACITY)
    spawnsByRoom[roomId] = slice.map((item) => ({ id: item.id, questionId: item.question.id }))
    for (const item of slice) reviews.push({ ...item, room_id: roomId })
  }
  return {
    dungeon: { id: dungeonId, name: 'Haunted Hall', rooms, questions: unique.map((i) => i.question) },
    reviews,
    spawnsByRoom,
    roomIds: rooms.map((r) => r.id),
    total: unique.length,
  }
}

/** Ghosts of a hall room that are not yet laid to rest. */
export function remainingSpawns(hall: Hall, roomId: string, rested: ReadonlySet<string>): RevenantSpawn[] {
  return (hall.spawnsByRoom[roomId] ?? []).filter((s) => !rested.has(s.id))
}

/** True when every ghost of the hall room is at rest (its gate may open). */
export function hallRoomAtRest(hall: Hall, roomId: string, rested: ReadonlySet<string>): boolean {
  return (hall.spawnsByRoom[roomId]?.length ?? 0) > 0 && remainingSpawns(hall, roomId, rested).length === 0
}
