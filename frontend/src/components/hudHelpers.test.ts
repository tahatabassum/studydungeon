import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { isLowHealth, roomMarkerState } from './hudHelpers'

// Feature: frontend-04-rpg-ui-combat-flow, Property 10: Low-health predicate
describe('Feature: frontend-04-rpg-ui-combat-flow, Property 10: Low-health predicate', () => {
  it('**Validates: Requirements 11.2** isLowHealth(hp, max) === (hp * 100 <= 30 * max)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10_000 }),
        fc.integer({ min: 1, max: 10_000 }),
        (hp, max) => {
          expect(isLowHealth(hp, max)).toBe(hp * 100 <= 30 * max)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('matches boundary examples', () => {
    expect(isLowHealth(30, 100)).toBe(true)
    expect(isLowHealth(31, 100)).toBe(false)
    expect(isLowHealth(0, 100)).toBe(true)
    expect(isLowHealth(100, 100)).toBe(false)
  })

  it('returns false when max <= 0', () => {
    expect(isLowHealth(0, 0)).toBe(false)
    expect(isLowHealth(-5, -10)).toBe(false)
    expect(isLowHealth(5, 0)).toBe(false)
  })
})

// Feature: frontend-04-rpg-ui-combat-flow, Property 11: Room marker state
describe('Feature: frontend-04-rpg-ui-combat-flow, Property 11: Room marker state', () => {
  const scenario = fc
    .uniqueArray(fc.stringMatching(/^[a-z0-9]{1,6}$/), { minLength: 0, maxLength: 12 })
    .chain((ids) =>
      fc.record({
        rooms: fc.tuple(...ids.map((id) => fc.record({ id: fc.constant(id), is_boss: fc.option(fc.boolean(), { nil: undefined }) }))),
        currentId: fc.oneof(
          ids.length > 0 ? fc.constantFrom(...ids) : fc.constant(null),
          fc.constant('unknown-room-id'),
          fc.constant(null),
        ),
        cleared: fc.subarray(ids),
      }),
    )

  it('**Validates: Requirements 12.1, 12.2** each room gets one correct state; isBoss independent; pure', () => {
    fc.assert(
      fc.property(scenario, ({ rooms, currentId, cleared }) => {
        for (const room of rooms) {
          const r = roomMarkerState(room, currentId, cleared)
          const expected = cleared.includes(room.id)
            ? 'cleared'
            : currentId !== null && room.id === currentId
              ? 'current'
              : 'locked'
          expect(['cleared', 'current', 'locked']).toContain(r.state)
          expect(r.state).toBe(expected)
          expect(r.isBoss).toBe(room.is_boss === true)
          expect(roomMarkerState(room, currentId, cleared)).toEqual(r)
        }
      }),
      { numRuns: 200 },
    )
  })
})
