import { describe, expect, it } from 'vitest'
import { WEAPONS } from '@/weapons/weapons'
import { WEAPON_FX_POOL, weaponFx } from './weapons'

describe('weapon strike descriptors', () => {
  it('gives each weapon its own shape: slash, bolt, arrow, shockwave, burst', () => {
    expect(WEAPONS.map((w) => weaponFx(w.id).shape)).toEqual(['slash', 'bolt', 'arrow', 'shockwave', 'burst'])
  })

  it('falls back to the dagger slash for an unknown or absent weapon id', () => {
    expect(weaponFx(undefined)).toEqual(weaponFx('rusty_dagger'))
    expect(weaponFx('nonsense')).toEqual(weaponFx('rusty_dagger'))
    expect(weaponFx('').shape).toBe('slash')
  })

  it('fits the pool of 16, lands the hit before the effect ends, and has a distinct colour per weapon', () => {
    const colors = new Set<number>()
    for (const w of WEAPONS) {
      const d = weaponFx(w.id)
      expect(d.count).toBeGreaterThan(0)
      // One more pooled object is reserved for a critical star.
      expect(d.count + 1).toBeLessThanOrEqual(WEAPON_FX_POOL)
      expect(d.impactMs).toBeLessThan(d.durationMs)
      colors.add(d.color)
    }
    expect(colors.size).toBe(WEAPONS.length)
  })
})
