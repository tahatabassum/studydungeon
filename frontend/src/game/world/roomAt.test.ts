import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { buildDungeonLayout, roomAt } from './DungeonLayout'
import type { DungeonLayout } from './DungeonLayout'

// Distinct orders -> unique ids; layout is always ok for these inputs.
const layoutArb = fc
  .uniqueArray(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 8 })
  .map((orders) => {
    const res = buildDungeonLayout(orders.map((o) => ({ id: `r${o}`, order: o })))
    if (!res.ok) throw new Error('unexpected layout error')
    return res.layout
  })

function containsHalfOpen(
  r: { x: number; y: number; w: number; h: number },
  p: { x: number; y: number },
): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h
}

const fcOpts = { numRuns: 100 }

describe('roomAt', () => {
  // Feature: frontend-03-phaser-core, Property 3: Room lookup consistency
  // **Validates: Requirements 3.5, 5.1, 5.3**
  it('returns the containing room for points inside the world, exactly one match', () => {
    fc.assert(
      fc.property(layoutArb, fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }), (layout: DungeonLayout, fx, fy) => {
        const p = {
          x: layout.world.x + Math.min(fx, 0.999999) * layout.world.w,
          y: layout.world.y + Math.min(fy, 0.999999) * layout.world.h,
        }
        const matches = layout.rooms.filter((r) => containsHalfOpen(r.rect, p))
        expect(matches).toHaveLength(1)
        expect(roomAt(layout, p)).toBe(matches[0].id)
      }),
      fcOpts,
    )
  })

  it('returns room k for any point strictly inside room k', () => {
    fc.assert(
      fc.property(
        layoutArb,
        fc.nat(),
        fc.double({ min: 0.01, max: 0.99, noNaN: true }),
        fc.double({ min: 0.01, max: 0.99, noNaN: true }),
        (layout, idx, fx, fy) => {
          const room = layout.rooms[idx % layout.rooms.length]
          const p = { x: room.rect.x + fx * room.rect.w, y: room.rect.y + fy * room.rect.h }
          expect(roomAt(layout, p)).toBe(room.id)
        },
      ),
      fcOpts,
    )
  })

  it('returns null for points outside the world bounds', () => {
    fc.assert(
      fc.property(
        layoutArb,
        fc.constantFrom('left', 'right', 'above', 'below'),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (layout, side, off, t) => {
          const { x, y, w, h } = layout.world
          const p =
            side === 'left'
              ? { x: x - 0.001 - off, y: y + t * h }
              : side === 'right'
                ? { x: x + w + off, y: y + t * h }
                : side === 'above'
                  ? { x: x + t * w, y: y - 0.001 - off }
                  : { x: x + t * w, y: y + h + off }
          expect(roomAt(layout, p)).toBeNull()
        },
      ),
      fcOpts,
    )
  })

  it('resolves shared boundaries to exactly one room: the one whose top edge it is', () => {
    fc.assert(
      fc.property(layoutArb, fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }), (layout, t) => {
        for (const room of layout.rooms) {
          const p = { x: room.rect.x + t * room.rect.w, y: room.rect.y }
          expect(roomAt(layout, p)).toBe(room.id)
          expect(roomAt(layout, p)).toBe(roomAt(layout, p))
        }
      }),
      fcOpts,
    )
  })
})
