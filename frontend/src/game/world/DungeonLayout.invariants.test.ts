import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { buildDungeonLayout } from './DungeonLayout'
import type { RoomInput } from './DungeonLayout'
import type { Point, Rect } from './RoomLayout'

// Feature: frontend-03-phaser-core, Property 1: Layout structural invariants
// **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

const inside = (r: Rect, p: Point) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h
const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h
const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** 1..8 rooms, unique orders, shuffled input, optional boss as the highest order. */
const roomsArb = fc
  .tuple(
    fc.uniqueArray(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 8 }),
    fc.boolean(),
  )
  .chain(([orders, withBoss]) => {
    const asc = [...orders].sort((a, b) => a - b)
    const rooms: RoomInput[] = asc.map((order, i) => ({
      id: `room-${order}`,
      order,
      is_boss: withBoss && i === asc.length - 1,
    }))
    return fc.shuffledSubarray(rooms, { minLength: rooms.length, maxLength: rooms.length })
  })

describe('Property 1: Layout structural invariants', () => {
  it('holds for any non-empty rooms with distinct orders', () => {
    fc.assert(
      fc.property(roomsArb, (input) => {
        const res = buildDungeonLayout(input)
        expect(res.ok).toBe(true)
        if (!res.ok) return
        const { rooms, gates, world, spawn } = res.layout
        const n = input.length
        const sortedIds = [...input].sort((a, b) => a.order - b.order).map((r) => r.id)

        // rooms ordered by ascending order
        expect(rooms.map((r) => r.id)).toEqual(sortedIds)

        // no overlaps, all inside world
        for (let i = 0; i < n; i++) {
          expect(contains(world, rooms[i].rect)).toBe(true)
          for (let j = i + 1; j < n; j++) expect(overlap(rooms[i].rect, rooms[j].rect)).toBe(false)
        }
        expect(world.x).toBe(0)
        expect(world.y).toBe(0)
        expect(world.h).toBe(rooms.reduce((s, r) => s + r.rect.h, 0))

        // gates: n-1, consecutive, in earlier room / passage in later room, aligned
        expect(gates).toHaveLength(n - 1)
        gates.forEach((g, k) => {
          expect(g.afterRoomId).toBe(rooms[k].id)
          expect(g.toRoomId).toBe(rooms[k + 1].id)
          expect(contains(rooms[k].rect, g.rect)).toBe(true)
          expect(contains(rooms[k + 1].rect, g.passage)).toBe(true)
          expect(g.passage.x).toBe(g.rect.x)
          expect(g.passage.w).toBe(g.rect.w)
          // adjacent rooms touch: gate in top wall, passage in bottom wall of the next
          expect(rooms[k + 1].rect.y + rooms[k + 1].rect.h).toBe(rooms[k].rect.y)
        })
        // last room has no exit gate
        expect(gates.some((g) => g.afterRoomId === rooms[n - 1].id)).toBe(false)

        // reachability from the first room via gate chain
        const reached = new Set([rooms[0].id])
        let grew = true
        while (grew) {
          grew = false
          for (const g of gates) {
            if (reached.has(g.afterRoomId) && !reached.has(g.toRoomId)) {
              reached.add(g.toRoomId)
              grew = true
            }
          }
        }
        expect(reached.size).toBe(n)

        // spawn inside first room
        expect(inside(rooms[0].rect, spawn)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })
})
