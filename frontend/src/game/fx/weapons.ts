import { COLORS } from '../colors'
import { resolveWeapon } from '@/weapons/weapons'

/**
 * Pure strike descriptors (no Phaser import). WeaponFxSystem reads one of these and draws the
 * effect from a pool of 16 reusable Graphics objects; nothing here allocates per frame.
 */
export type StrikeShape = 'slash' | 'bolt' | 'arrow' | 'shockwave' | 'burst'

export interface WeaponFxDescriptor {
  shape: StrikeShape
  /** Main colour (0xRRGGBB). */
  color: number
  /** Hot core / highlight colour. */
  accent: number
  /** Pooled Graphics objects the strike uses (never above the pool size of 16). */
  count: number
  /** Total length of the effect in ms. */
  durationMs: number
  /** Delay from the start of the strike to the moment the hit lands (flash, HP bar, wisps). */
  impactMs: number
}

export const WEAPON_FX_POOL = 16

const FX: Readonly<Record<string, WeaponFxDescriptor>> = {
  rusty_dagger: { shape: 'slash', color: COLORS.EMBER, accent: COLORS.BONE, count: 3, durationMs: 300, impactMs: 80 },
  arcane_staff: { shape: 'bolt', color: COLORS.MAGIC, accent: COLORS.BONE, count: 3, durationMs: 460, impactMs: 230 },
  hunter_crossbow: { shape: 'arrow', color: COLORS.GOLD, accent: COLORS.BONE, count: 3, durationMs: 400, impactMs: 170 },
  spectral_hammer: { shape: 'shockwave', color: COLORS.GHOST, accent: COLORS.BONE, count: 4, durationMs: 560, impactMs: 120 },
  flame_sigil: { shape: 'burst', color: COLORS.PUMPKIN, accent: COLORS.GOLD, count: 8, durationMs: 700, impactMs: 160 },
}

/** The strike for a weapon id; an unknown or absent id gets the Rusty Dagger slash. */
export function weaponFx(id?: string): WeaponFxDescriptor {
  return FX[resolveWeapon(id).id]
}
