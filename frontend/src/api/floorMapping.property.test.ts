import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { dungeonSchema } from './schemas'
import { LEGACY_FLOOR_TITLE, withFloors } from './floorMapping'
import { mapDungeon, wireDungeonSchema } from './wire'

const roomArb = fc.record({
  id: fc.uuid(),
  room_number: fc.integer({ min: 1, max: 40 }),
  topic_name: fc.string({ minLength: 1, maxLength: 12 }),
  monster_name: fc.string({ minLength: 1, maxLength: 12 }),
  monster_type: fc.constantFrom('Silicon Golem', 'Toxic Slime', 'Memory Wraith', 'Anything'),
  monster_hp: fc.integer({ min: 1, max: 300 }),
  is_boss: fc.boolean(),
  questions: fc.array(
    fc.record({
      id: fc.uuid(),
      prompt: fc.string({ minLength: 1, maxLength: 20 }),
      options: fc.constant(['A', 'B', 'C']),
      difficulty: fc.constantFrom('easy', 'medium', 'hard'),
    }),
    { minLength: 1, maxLength: 3 },
  ),
})

const wireArb = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 20 }),
  rooms: fc.uniqueArray(roomArb, { minLength: 1, maxLength: 8, selector: (r) => r.room_number }),
})

describe('legacy floor mapping', () => {
  // Feature: frontend-08-campaign-learning-loop, Property 2: Legacy dungeons become one honest floor
  // **Validates: Requirements 2.6**
  it('Property 2: a dungeon with rooms and no floors gets exactly one floor "The Crypt" holding every room in order', () => {
    fc.assert(
      fc.property(wireArb, (wire) => {
        const dungeon = mapDungeon(wireDungeonSchema.parse(wire))
        expect(dungeon.floors).toHaveLength(1)
        const floor = dungeon.floors![0]
        expect(floor.title).toBe(LEGACY_FLOOR_TITLE)
        expect(floor.room_ids).toEqual([...dungeon.rooms].sort((a, b) => a.order - b.order).map((r) => r.id))
        expect(dungeon.final_boss).toBeUndefined()
        expect(dungeonSchema.safeParse(dungeon).success).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('keeps floors the backend already sent', () => {
    const wire = wireArb.map((w) => w)
    fc.assert(
      fc.property(wire, (w) => {
        const base = mapDungeon(wireDungeonSchema.parse(w))
        const own = { ...base, floors: [{ ...base.floors![0], id: 'f-own', title: 'Own' }] }
        expect(withFloors(own).floors![0].id).toBe('f-own')
      }),
      { numRuns: 100 },
    )
  })
})
