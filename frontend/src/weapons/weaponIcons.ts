import { Crosshair, Flame, Hammer, Sword, WandSparkles, type LucideIcon } from 'lucide-react'
import type { WeaponId } from '@/types/api'

/** Small line icons per weapon (lucide, no emoji). Shared by the Armory and the Scorecard. */
export const WEAPON_ICONS: Readonly<Record<WeaponId, LucideIcon>> = {
  rusty_dagger: Sword,
  arcane_staff: WandSparkles,
  hunter_crossbow: Crosshair,
  spectral_hammer: Hammer,
  flame_sigil: Flame,
}
