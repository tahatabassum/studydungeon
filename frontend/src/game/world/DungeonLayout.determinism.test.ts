import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import { buildDungeonLayout } from './DungeonLayout'
import type { RoomInput } from './DungeonLayout'

// Rooms with distinct `order` values and distinct ids, in arbitrary input order.
const roomsArb = fc
  .uniqueArray(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 8 })
  .chain((orders) =>
    fc.tuple(
      fc.constant(orders),
      fc.array(fc.boolean(), { minLength: orders.length, maxLength: orders.length }),
    ),
  )
  .map(([orders, boss]): RoomInput[] =>
    orders.map((order, i) => ({ id: `room-${order}`, order, is_boss: boss[i] })),
  )

describe('buildDungeonLayout determinism', () => {
  // Feature: frontend-03-phaser-core, Property 2: Layout determinism and input-order independence
  // **Validates: Requirements 2.5, 2.7**
  it('is deterministic and independent of input order', () => {
    fc.assert(
      fc.property(
        roomsArb.chain((rooms) => fc.tuple(fc.constant(rooms), fc.shuffledSubarray(rooms, { minLength: rooms.length, maxLength: rooms.length }))),
        ([rooms, permuted]) => {
          const a = buildDungeonLayout(rooms)
          const b = buildDungeonLayout(rooms)
          const c = buildDungeonLayout(permuted)
          expect(a.ok).toBe(true)
          expect(b).toEqual(a)
          expect(c).toEqual(a)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('returns a typed error for an empty list', () => {
    expect(buildDungeonLayout([])).toEqual({ ok: false, error: 'empty' })
  })

  it('returns a typed error for duplicate order values', () => {
    const result = buildDungeonLayout([
      { id: 'a', order: 1 },
      { id: 'b', order: 1 },
    ])
    expect(result).toEqual({ ok: false, error: 'duplicate-order' })
  })
})
