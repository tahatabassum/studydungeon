import { describe, expect, it } from 'vitest'
import { PILLARS, TILE, WORLD_H, WORLD_W } from '../world/RoomLayout'
import { revenantSlots } from './revenantSlots'

describe('revenantSlots', () => {
  it('returns 0 to 3 slots inside the room and clear of the pillars', () => {
    const origin = { x: 1280, y: -800 }
    for (const n of [0, 1, 2, 3, 7]) {
      const slots = revenantSlots(n, origin)
      expect(slots).toHaveLength(Math.min(3, n))
      for (const s of slots) {
        const rx = s.x - origin.x
        const ry = s.y - origin.y
        expect(rx).toBeGreaterThan(TILE)
        expect(rx).toBeLessThan(WORLD_W - TILE)
        expect(ry).toBeGreaterThan(TILE)
        expect(ry).toBeLessThan(WORLD_H - TILE)
        for (const p of PILLARS) {
          const inside = rx > p.x - 48 && rx < p.x + p.w + 48 && ry > p.y - 48 && ry < p.y + p.h + 48
          expect(inside).toBe(false)
        }
      }
    }
  })

  it('clamps an x hint inside the walls', () => {
    const [a] = revenantSlots(1, { x: 0, y: 0 }, [-500])
    const [b] = revenantSlots(1, { x: 0, y: 0 }, [99999])
    expect(a.x).toBeGreaterThan(0)
    expect(b.x).toBeLessThan(WORLD_W)
  })
})
