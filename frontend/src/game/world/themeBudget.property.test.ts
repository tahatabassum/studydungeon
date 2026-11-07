import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { THEME_IDS, THEMES, MAX_PARTICLES } from './roomTheme'
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
