import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { dungeonSchema } from '../../schemas'
import { FIXTURE_FLOOR_COUNTS, buildFloorFixture, type FixtureStatusMode } from './floorFixture'
import { floorFixtures } from './index'

const modeArb = fc.constantFrom<FixtureStatusMode>('mixed', 'locked', 'ready', 'generating', 'failed', 'cleared')

describe('floor fixtures', () => {
  // Feature: frontend-08-campaign-learning-loop, Property 3: Floor fixtures are valid at every size
  // **Validates: Requirements 2.5, 2.7**
  it('Property 3: valid schema, unique floor ids, contiguous indexes from 1, and a Final_Boss at every size', () => {
    fc.assert(
      fc.property(fc.constantFrom(...FIXTURE_FLOOR_COUNTS), modeArb, (count, mode) => {
        const { dungeon, floors, final_boss } = buildFloorFixture(count, mode)
        expect(dungeonSchema.safeParse(dungeon).success).toBe(true)
        expect(floors).toHaveLength(count)
        expect(new Set(floors.map((f) => f.id)).size).toBe(count)
        expect(floors.map((f) => f.index)).toEqual(Array.from({ length: count }, (_, i) => i + 1))
        expect(dungeon.final_boss).toEqual(final_boss)
        expect(final_boss.name.length).toBeGreaterThan(0)
        const roomIds = new Set(dungeon.rooms.map((r) => r.id))
        for (const f of floors) for (const id of f.room_ids) expect(roomIds.has(id)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('exposes the four registered sizes, mixed statuses, pools of 15 to 20 sample questions', () => {
    expect(Object.keys(floorFixtures).map(Number)).toEqual([1, 3, 10, 25])
    const mixed = new Set(floorFixtures[25].floors.map((f) => f.status))
    expect(mixed).toEqual(new Set(['cleared', 'ready', 'generating', 'failed', 'locked']))
    const room = floorFixtures[3].dungeon.rooms[0]
    expect(room.monster.question_ids.length).toBeGreaterThanOrEqual(15)
    expect(room.monster.question_ids.length).toBeLessThanOrEqual(20)
    expect(floorFixtures[3].dungeon.questions[0].prompt).toContain('Sample question')
  })
})
