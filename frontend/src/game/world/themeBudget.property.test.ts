import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { THEME_IDS, THEMES, MAX_PARTICLES } from './roomTheme'
import { roomCandleLights } from './roomProps'
import { AMBIENT_CAP, PIECE_CAP, REDUCED_AMBIENT_CAP, ROOM_TOTAL_CAP, themeBudget } from './themeBudget'

// Feature: frontend-06-halloween-visuals, Property 7: Theme budgets respect the caps
// **Validates: Requirements 2.2, 2.3, 10.1, 10.2, 10.3**

describe('Property 7: Theme budgets respect the caps', () => {
  it('holds for every theme and reduced-motion flag', () => {
    fc.assert(
      fc.property(fc.constantFrom(...THEME_IDS), fc.boolean(), (id, reduced) => {
        const b = themeBudget(THEMES[id], reduced)
        expect(b.ambient).toBeLessThanOrEqual(AMBIENT_CAP)
        expect(b.pieces).toBeLessThanOrEqual(PIECE_CAP)
        expect(b.total).toBeLessThanOrEqual(ROOM_TOTAL_CAP)
        expect(b.total).toBe(b.ambient + b.pieces)
        if (reduced) expect(b.ambient).toBeLessThanOrEqual(REDUCED_AMBIENT_CAP)
      }),
      { numRuns: 100 },
    )
  })

  it('pooled piece images and light pools fit their pools for every theme', () => {
    const WEBGL_LIGHTS = 12 // MAX_LIGHTS_WEBGL in LightSystem (not imported: it pulls in Phaser)
    for (const id of THEME_IDS) {
      const t = THEMES[id]
      const pooled = t.pieces.filter((p) => p.kind !== 'lightning').reduce((n, p) => n + p.count, 0)
      expect(pooled, id).toBeLessThanOrEqual(PIECE_CAP)
      const candles = roomCandleLights(id, 1).length
      expect(4 + t.lights.length + candles, id).toBeLessThanOrEqual(WEBGL_LIGHTS)
    }
  })

  it('only the boss hall has lightning, and it is dropped from the reduced budget', () => {
    for (const id of THEME_IDS) {
      const has = THEMES[id].pieces.some((p) => p.kind === 'lightning')
      expect(has, id).toBe(id === 'boss_hall')
    }
    const full = themeBudget(THEMES.boss_hall, false)
    const reduced = themeBudget(THEMES.boss_hall, true)
    expect(reduced.pieces).toBe(full.pieces - 1)
  })

  it('every registered theme is within the caps (example iteration)', () => {
    expect(AMBIENT_CAP).toBe(MAX_PARTICLES)
    for (const id of THEME_IDS) {
      for (const reduced of [false, true]) {
        const b = themeBudget(THEMES[id], reduced)
        expect(b.total, `${id} reduced=${String(reduced)}`).toBeLessThanOrEqual(ROOM_TOTAL_CAP)
      }
    }
  })
})
