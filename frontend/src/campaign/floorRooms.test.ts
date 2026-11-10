import { describe, expect, it } from 'vitest'
import demoDungeon from '../demo/demoDungeon.json'
import { buildDungeonLayout } from '../game/world/DungeonLayout'
import { buildFloors, DEMO_FLOOR_DEFS } from '../learning/floors'
import type { Dungeon } from '../types/api'
import { floorDungeon } from './floorRooms'

/** The demo as the mock serves it: 2 floors plus the Final_Boss. */
function served(): Dungeon {
  const base = structuredClone(demoDungeon) as unknown as Dungeon
  const view = buildFloors(DEMO_FLOOR_DEFS, base.rooms, {
    clearedRoomIds: new Set(),
    ranks: new Map(),
    masteryOf: () => 0,
  })
  return { ...base, floors: view.floors, ...(view.final_boss ? { final_boss: view.final_boss } : {}) }
}

describe('floorDungeon', () => {
  it('keeps only the floor rooms, renumbers them and makes the last one the boss', () => {
    const d = floorDungeon(served(), 'floor-2')!
    expect(d.rooms.map((r) => [r.id, r.order, r.is_boss])).toEqual([
      ['room-3', 1, false],
      ['room-4', 2, true],
    ])
    const wanted = new Set(d.rooms.flatMap((r) => r.monster.question_ids))
    expect(d.questions.every((q) => wanted.has(q.id))).toBe(true)
    expect(d.questions.length).toBe(wanted.size)
  })

  it('builds the layout from the floor rooms only: one gate, none after the boss', () => {
    const d = floorDungeon(served(), 'floor-2')!
    const result = buildDungeonLayout(d.rooms)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.layout.rooms.map((r) => r.id)).toEqual(['room-3', 'room-4'])
    expect(result.layout.gates.map((g) => [g.afterRoomId, g.toRoomId])).toEqual([['room-3', 'room-4']])
    expect(result.layout.rooms[1].isBoss).toBe(true)
  })

  it('the Final_Boss plays alone in a single boss room', () => {
    const view = served()
    const d = floorDungeon(view, view.final_boss!.id)!
    expect(d.rooms).toHaveLength(1)
    expect(d.rooms[0]).toMatchObject({ id: 'room-5', order: 1, is_boss: true })
    const result = buildDungeonLayout(d.rooms)
    expect(result.ok && result.layout.gates.length).toBe(0)
  })

  it('a dungeon without floors becomes one legacy floor with every room', () => {
    const legacy = structuredClone(demoDungeon) as unknown as Dungeon
    const d = floorDungeon(legacy, 'floor-legacy')!
    expect(d.rooms).toHaveLength(5)
    expect(d.rooms.filter((r) => r.is_boss).map((r) => r.id)).toEqual(['room-5'])
  })

  it('returns null for an unknown floor', () => {
    expect(floorDungeon(served(), 'floor-99')).toBeNull()
  })
})
