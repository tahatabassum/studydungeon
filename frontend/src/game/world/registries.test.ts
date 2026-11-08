import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { THEME_IDS, THEMES, MAX_PARTICLES } from './roomTheme'
import { overlapsRect, placementsFor } from './decorPlacement'
import { GATE, MONSTER_SPAWN, PILLARS, PLAYER_SPAWN, TILE, type Rect } from './RoomLayout'
import { validatePixelMap } from '@/art/pixelMap'
import { deriveFrames } from '@/art/frames'
import { MONSTER_SPRITES, SPRITE_REGISTRY } from '@/art/sprites'
import { MONSTER_FRAME_KINDS, buildArtPlan } from '../textures/registerArt'

// Feature: frontend-04-rpg-ui-combat-flow, Property 14: Registries are consistent
// **Validates: Requirements 14.1, 15.4, 18.1**

const themeArb = fc.constantFrom(...THEME_IDS)
const kindArb = fc.constantFrom(...Object.keys(MONSTER_SPRITES))

describe('Property 14: Registries are consistent', () => {
  it('every theme decor sprite exists in SPRITE_REGISTRY and validates', () => {
    fc.assert(
      fc.property(themeArb, (id) => {
        expect(THEMES[id].decor.length).toBeGreaterThan(0)
        for (const d of THEMES[id].decor) {
          const map = SPRITE_REGISTRY[d.sprite]
          expect(map, `${id}: ${d.sprite}`).toBeDefined()
          expect(validatePixelMap(map)).toEqual([])
        }
      }),
      { numRuns: 100 },
    )
  })

  it('every monster kind has valid idle, attack, hit and death frames', () => {
    fc.assert(
      fc.property(kindArb, (kind) => {
        for (const fk of MONSTER_FRAME_KINDS) {
          const frames = deriveFrames(MONSTER_SPRITES[kind], fk)
          expect(frames.length).toBeGreaterThan(0)
          for (const f of frames) expect(validatePixelMap(f, true)).toEqual([])
        }
      }),
      { numRuns: 100 },
    )
  })

  it('particle counts stay within the global cap', () => {
    fc.assert(
      fc.property(themeArb, (id) => {
        expect(THEMES[id].particles.count).toBeGreaterThan(-1)
        expect(THEMES[id].particles.count).toBeLessThanOrEqual(MAX_PARTICLES)
      }),
      { numRuns: 100 },
    )
  })

  it('the art plan has unique texture keys and animations only use planned textures', () => {
    const plan = buildArtPlan()
    const keys = plan.textures.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const a of plan.anims) for (const t of a.textures) expect(keys).toContain(t)
  })

  it('decor never overlaps spawns, the gate, or pillars and stays inside the room', () => {
    const origin = { x: 0, y: 0 }
    const spawn = (p: { x: number; y: number }): Rect => ({ x: p.x - 40, y: p.y - 40, w: 80, h: 80 })
    const keepOut: Rect[] = [spawn(PLAYER_SPAWN), spawn(MONSTER_SPAWN), GATE, ...PILLARS]
    fc.assert(
      fc.property(themeArb, (id) => {
        for (const p of placementsFor(THEMES[id], origin)) {
          expect(p.w).toBeGreaterThan(0)
          expect(p.x - p.w / 2).toBeGreaterThanOrEqual(TILE)
          expect(p.y - p.h / 2).toBeGreaterThanOrEqual(TILE)
          for (const r of keepOut) expect(overlapsRect(p, r), `${id}:${p.sprite}`).toBe(false)
        }
      }),
      { numRuns: 100 },
    )
  })
})
