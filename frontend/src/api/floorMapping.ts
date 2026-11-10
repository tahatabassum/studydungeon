import type { Dungeon, Floor } from '../types/api'

/** Title of the single Floor built for a backend that has no floors (D17). */
export const LEGACY_FLOOR_TITLE = 'The Crypt'
export const LEGACY_FLOOR_ID = 'floor-legacy'

/**
 * D17: a dungeon without `floors` becomes ONE honest Floor holding every room in order.
 * Nothing is split by room count. The Floor_Boss is the boss room (else the last room).
 * Pure.
 */
export function legacyFloor(dungeon: Pick<Dungeon, 'rooms'>): Floor {
  const ordered = [...dungeon.rooms].sort((a, b) => a.order - b.order)
  const bossRoom = ordered.find((r) => r.is_boss) ?? ordered[ordered.length - 1]
  return {
    id: LEGACY_FLOOR_ID,
    index: 1,
    title: LEGACY_FLOOR_TITLE,
    status: 'ready',
    topics: ordered.map((r) => ({ id: r.id, title: r.label, mastery: 0 })),
    boss: {
      id: bossRoom.monster.id,
      name: bossRoom.monster.name,
      hp: bossRoom.monster.max_hp,
      kind: bossRoom.monster.kind,
    },
    rank: null,
    room_ids: ordered.map((r) => r.id),
  }
}

/** Returns the dungeon unchanged when it already has floors, else with the legacy Floor attached. */
export function withFloors(dungeon: Dungeon): Dungeon {
  if (dungeon.floors && dungeon.floors.length > 0) return dungeon
  if (dungeon.rooms.length === 0) return dungeon
  return { ...dungeon, floors: [legacyFloor(dungeon)] }
}
