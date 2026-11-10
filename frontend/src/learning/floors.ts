import type { FinalBoss, Floor, FloorRank, FloorStatus, Room } from '../types/api'

/**
 * MOCK-ONLY floors for the seeded demo (D13). Exactly 2 Floors plus the Final_Boss:
 *   Floor 1 "The Entry Crypt"   = rooms 1 and 2 (Floor_Boss = room 2's monster)
 *   Floor 2 "The Alchemy Wing"  = rooms 3 and 4 (Floor_Boss = room 4's monster)
 *   Final_Boss                  = room 5, the Exam Warden
 * The real Backend sends `floors[]` itself; real mode never imports this module.
 */
export interface FloorDef {
  id: string
  index: number
  title: string
  /** Room ids in play order; the last one holds the Floor_Boss. */
  roomIds: readonly string[]
}

export const DEMO_FLOOR_DEFS: readonly FloorDef[] = [
  { id: 'floor-1', index: 1, title: 'The Entry Crypt', roomIds: ['room-1', 'room-2'] },
  { id: 'floor-2', index: 2, title: 'The Alchemy Wing', roomIds: ['room-3', 'room-4'] },
]
export const DEMO_FINAL_BOSS_ROOM_ID = 'room-5'

export interface FloorState {
  /** Rooms cleared in any run of this adapter. */
  clearedRoomIds: ReadonlySet<string>
  /** Best rank earned per floor id. */
  ranks: ReadonlyMap<string, FloorRank>
  masteryOf(topicId: string): number
  /** Dev switch: floors forced into a status (for example `failed`). */
  forced?: ReadonlyMap<string, FloorStatus>
  /** Room that holds the Final_Boss. Default: the mock demo's `room-5`. */
  finalBossRoomId?: string
}

/** A floor is cleared when its last room (the Floor_Boss room) is cleared. */
export function isFloorCleared(def: FloorDef, cleared: ReadonlySet<string>): boolean {
  return cleared.has(def.roomIds[def.roomIds.length - 1])
}

export function buildFloors(
  defs: readonly FloorDef[],
  rooms: readonly Room[],
  state: FloorState,
): { floors: Floor[]; final_boss: FinalBoss | undefined; roomFloor: Map<string, string> } {
  const byId = new Map(rooms.map((r) => [r.id, r]))
  const roomFloor = new Map<string, string>()
  let previousCleared = true
  const floors: Floor[] = defs.map((def) => {
    const own = def.roomIds.flatMap((id) => {
      const r = byId.get(id)
      return r ? [r] : []
    })
    const boss = own[own.length - 1]
    for (const id of def.roomIds) roomFloor.set(id, def.id)
    const cleared = isFloorCleared(def, state.clearedRoomIds)
    const natural: FloorStatus = cleared ? 'cleared' : previousCleared ? 'ready' : 'locked'
    previousCleared = cleared
    return {
      id: def.id,
      index: def.index,
      title: def.title,
      status: state.forced?.get(def.id) ?? natural,
      topics: own.map((r) => ({ id: r.id, title: r.label, mastery: state.masteryOf(r.id) })),
      boss: { id: boss.monster.id, name: boss.monster.name, hp: boss.monster.max_hp, kind: boss.monster.kind },
      rank: state.ranks.get(def.id) ?? null,
      room_ids: [...def.roomIds],
    }
  })
  const finalRoom = byId.get(state.finalBossRoomId ?? DEMO_FINAL_BOSS_ROOM_ID)
  const final_boss: FinalBoss | undefined = finalRoom
    ? {
        id: finalRoom.monster.id,
        name: finalRoom.monster.name,
        hp: finalRoom.monster.max_hp,
        unlocked: floors.every((f) => f.status === 'cleared'),
      }
    : undefined
  return { floors, final_boss, roomFloor }
}
