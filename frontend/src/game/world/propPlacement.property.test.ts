import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { placeProps, type PropKind } from './propPlacement'
import { propBlockers } from './keepOut'
import { CRYPT_PROP_KINDS, cryptBlockers, cryptProps } from './cryptProps'
import { PILLARS, TILE, WORLD_H, WORLD_W, type Rect } from './RoomLayout'
import { keepOutZone } from './keepOut'

// Feature: frontend-06-halloween-visuals, Property 5: Placed props never block
// Feature: frontend-06-halloween-visuals, Property 6: Prop placement is deterministic
// **Validates: Requirements 7.5, 9.1, 9.2, 9.3**

const hits = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

const kindsArb = fc.array(
  fc.record({
    kind: fc.constantFrom('bone', 'candle', 'paper', 'rune'),
    size: fc.record({ w: fc.integer({ min: 4, max: 64 }), h: fc.integer({ min: 4, max: 64 }) }),
    count: fc.integer({ min: 0, max: 12 }),
  }),
  { maxLength: 5 },
)

describe('Property 5: Placed props never block', () => {
  it('stay inside the interior and out of keep-out, pillars and each other', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), kindsArb, (seed, kinds) => {
        const placed = placeProps(seed, kinds, propBlockers())
        placed.forEach((p, i) => {
          expect(p.x).toBeGreaterThanOrEqual(TILE)
          expect(p.y).toBeGreaterThanOrEqual(TILE)
          expect(p.x + p.w).toBeLessThanOrEqual(WORLD_W - TILE)
          expect(p.y + p.h).toBeLessThanOrEqual(WORLD_H - TILE)
          for (const z of keepOutZone()) expect(hits(p, z)).toBe(false)
          for (const z of PILLARS) expect(hits(p, z)).toBe(false)
          for (let j = i + 1; j < placed.length; j++) expect(hits(p, placed[j])).toBe(false)
        })
      }),
      { numRuns: 100 },
    )
  })

  it('the Clockwork Crypt list avoids all of its blockers and places fully for 200 seeds', () => {
    const total = CRYPT_PROP_KINDS.reduce((n: number, k: PropKind) => n + k.count, 0)
    const blockers = cryptBlockers()
    for (let seed = 0; seed < 200; seed++) {
      const placed = cryptProps(seed)
      expect(placed.length).toBe(total)
      for (const p of placed) for (const b of blockers) expect(hits(p, b)).toBe(false)
    }
  })
})

describe('Property 6: Prop placement is deterministic', () => {
  it('returns equal results for equal seeds', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), kindsArb, (seed, kinds) => {
        expect(placeProps(seed, kinds, propBlockers())).toEqual(placeProps(seed, kinds, propBlockers()))
      }),
      { numRuns: 100 },
    )
  })
})
