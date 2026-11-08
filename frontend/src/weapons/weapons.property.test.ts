import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { WEAPONS, armoryEntries, resolveWeapon } from './weapons'

// Feature: frontend-07-premium-ux-leaderboard, Property 9: Weapon resolution
describe('Property 9: Weapon resolution', () => {
  const knownIds = WEAPONS.map((w) => w.id as string)

  it('resolves a known id to its Weapon and anything else to the Rusty Dagger', () => {
    /** Validates: Requirements 7.2, 7.3 */
    fc.assert(
      fc.property(fc.option(fc.oneof(fc.string(), fc.constantFrom(...knownIds)), { nil: undefined }), (id) => {
        const w = resolveWeapon(id)
        if (id !== undefined && knownIds.includes(id)) expect(w.id).toBe(id)
        else expect(w.id).toBe('rusty_dagger')
      }),
      { numRuns: 100 },
    )
  })

  it('the Armory marks a weapon unlocked exactly when its unlock level is at most the player level', () => {
    /** Validates: Requirements 7.5 */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.array(fc.tuple(fc.constantFrom(...knownIds), fc.integer({ min: 1, max: 15 })), { maxLength: 8 }),
        (level, list) => {
          const rows = armoryEntries(
            list.map(([id, unlock_level]) => ({ id, unlock_level })),
            level,
          )
          expect(rows).toHaveLength(list.length)
          rows.forEach((row, i) => {
            expect(row.unlocked).toBe(list[i][1] <= level)
            expect(row.unlockLevel).toBe(list[i][1])
          })
        },
      ),
      { numRuns: 100 },
    )
  })

  it('knows the five weapons with the proposed unlock levels', () => {
    expect(WEAPONS.map((w) => [w.id, w.unlockLevel])).toEqual([
      ['rusty_dagger', 1],
      ['arcane_staff', 2],
      ['hunter_crossbow', 3],
      ['spectral_hammer', 5],
      ['flame_sigil', 8],
    ])
  })
})
