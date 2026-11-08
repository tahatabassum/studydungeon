import type { WeaponId } from '@/types/api'

/**
 * Weapon catalogue (presentation plus the real balance table, C13). The backend decides which weapon
 * a strike used and which weapons are unlocked. `unlockLevel` is a legacy display fallback only; the
 * real rules are in `requirement` (100 XP, clear 2 rooms, level 3, first boss).
 * Pure TypeScript: no Phaser, React or API imports beyond types.
 */
export interface Weapon {
  id: WeaponId
  name: string
  /** Legacy display fallback for lists that carry no unlock data. */
  unlockLevel: number
  /** Short flavour line for the Armory. */
  blurb: string
  /** Real base damage before the hard (x1.25) and critical (x1.5) multipliers. */
  baseDamage: number
  /** Real unlock rule in words (display only; the backend decides). */
  requirement: string
}

export const WEAPONS: readonly Weapon[] = Object.freeze([
  { id: 'rusty_dagger', name: 'Rusty Dagger', unlockLevel: 1, blurb: 'A quick slash.', baseDamage: 20, requirement: 'Always unlocked' },
  { id: 'arcane_staff', name: 'Arcane Staff', unlockLevel: 2, blurb: 'Hurls a violet bolt.', baseDamage: 25, requirement: 'Earn 100 XP' },
  { id: 'hunter_crossbow', name: 'Hunter Crossbow', unlockLevel: 3, blurb: 'A swift, piercing arrow.', baseDamage: 30, requirement: 'Clear 2 rooms' },
  { id: 'spectral_hammer', name: 'Spectral Hammer', unlockLevel: 5, blurb: 'Shakes the floor.', baseDamage: 35, requirement: 'Reach level 3' },
  { id: 'flame_sigil', name: 'Flame Sigil', unlockLevel: 8, blurb: 'Bursts into witch-fire.', baseDamage: 40, requirement: 'Defeat a boss' },
] as const)

export const DEFAULT_WEAPON: Weapon = WEAPONS[0]

/** The matching Weapon for a known id; the Rusty Dagger for an unknown or absent id. */
export function resolveWeapon(id?: string): Weapon {
  if (id === undefined) return DEFAULT_WEAPON
  return WEAPONS.find((w) => w.id === id) ?? DEFAULT_WEAPON
}

/** Backend weapon name ("Arcane Staff") to our id; undefined for an unknown name. */
export function weaponIdFromName(name: string): WeaponId | undefined {
  return WEAPONS.find((w) => w.name.toLowerCase() === name.trim().toLowerCase())?.id
}

/** Our id to the backend weapon name; the Rusty Dagger for an unknown id. */
export function weaponNameFromId(id?: string): string {
  return resolveWeapon(id).name
}

/** True when the weapon's unlock level is at most the player level. */
export function isUnlocked(unlockLevel: number, playerLevel: number): boolean {
  return unlockLevel <= playerLevel
}

/** Best (highest base damage) weapon among the given unlocked ids; the Rusty Dagger when none match. */
export function bestWeaponAmong(ids: readonly string[]): Weapon {
  let best = DEFAULT_WEAPON
  for (const w of WEAPONS) if (ids.includes(w.id) && w.baseDamage >= best.baseDamage) best = w
  return best
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
  /** Real unlock rule, shown for locked weapons when the list came with one. */
  requirement?: string
}

/**
 * Armory rows for a progress response: every listed weapon, marked unlocked exactly when its
 * unlock level is at most the player level. Unknown ids are ignored.
 */
export function armoryEntries(
  list: readonly { id: string; unlock_level: number; requirement?: string }[],
  level: number,
): ArmoryEntry[] {
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
      ...(item.requirement !== undefined ? { requirement: item.requirement } : {}),
    })
  }
  return out
}
