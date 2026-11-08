import type { WeaponId } from '@/types/api'

/**
 * Weapon catalogue (presentation only). The backend decides which weapon a result used
 * (`weapon_id`); the unlock levels below are the PROPOSED values the mock follows (design D7).
 * Pure TypeScript: no Phaser, React or API imports beyond types.
 */
export interface Weapon {
  id: WeaponId
  name: string
  /** Level at which the weapon unlocks (mock only; real mode reads progress.weapons). */
  unlockLevel: number
  /** Short flavour line for the Armory. */
  blurb: string
}

export const WEAPONS: readonly Weapon[] = Object.freeze([
  { id: 'rusty_dagger', name: 'Rusty Dagger', unlockLevel: 1, blurb: 'A quick slash.' },
  { id: 'arcane_staff', name: 'Arcane Staff', unlockLevel: 2, blurb: 'Hurls a violet bolt.' },
  { id: 'hunter_crossbow', name: 'Hunter Crossbow', unlockLevel: 3, blurb: 'A swift, piercing arrow.' },
  { id: 'spectral_hammer', name: 'Spectral Hammer', unlockLevel: 5, blurb: 'Shakes the floor.' },
  { id: 'flame_sigil', name: 'Flame Sigil', unlockLevel: 8, blurb: 'Bursts into witch-fire.' },
] as const)

export const DEFAULT_WEAPON: Weapon = WEAPONS[0]

/** The matching Weapon for a known id; the Rusty Dagger for an unknown or absent id. */
export function resolveWeapon(id?: string): Weapon {
  if (id === undefined) return DEFAULT_WEAPON
  return WEAPONS.find((w) => w.id === id) ?? DEFAULT_WEAPON
}

/** True when the weapon's unlock level is at most the player level. */
export function isUnlocked(unlockLevel: number, playerLevel: number): boolean {
  return unlockLevel <= playerLevel
}

/** Mock only: the best (highest unlock level) weapon available at a level. */
export function weaponForLevel(level: number): Weapon {
  let best = DEFAULT_WEAPON
  for (const w of WEAPONS) if (isUnlocked(w.unlockLevel, level)) best = w
  return best
}

/** A weapon list entry as the Armory shows it. */
export interface ArmoryEntry {
  id: WeaponId
  name: string
  blurb: string
  unlockLevel: number
  unlocked: boolean
}

/**
 * Armory rows for a progress response: every listed weapon, marked unlocked exactly when its
 * unlock level is at most the player level. Unknown ids are ignored.
 */
export function armoryEntries(list: readonly { id: string; unlock_level: number }[], level: number): ArmoryEntry[] {
  const out: ArmoryEntry[] = []
  for (const item of list) {
    const w = WEAPONS.find((x) => x.id === item.id)
    if (!w) continue
    out.push({
      id: w.id,
      name: w.name,
      blurb: w.blurb,
      unlockLevel: item.unlock_level,
      unlocked: isUnlocked(item.unlock_level, level),
    })
  }
  return out
}
