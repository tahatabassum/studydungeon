import { Crosshair, Flame, Hammer, Lock, Sword, WandSparkles, type LucideIcon } from 'lucide-react'
import type { WeaponId } from '@/types/api'
import { armoryEntries } from './weapons'

/** Small line icons per weapon (lucide, no emoji). */
const ICONS: Readonly<Record<WeaponId, LucideIcon>> = {
  rusty_dagger: Sword,
  arcane_staff: WandSparkles,
  hunter_crossbow: Crosshair,
  spectral_hammer: Hammer,
  flame_sigil: Flame,
}

export interface ArmoryProps {
  /** `progress.weapons`: every weapon with its unlock level. Renders nothing when absent or empty. */
  weapons: readonly { id: string; unlock_level: number }[] | undefined
  /** The player's level (`progress.level`). */
  level: number | undefined
  className?: string
}

/**
 * Lists every weapon from the progress response as unlocked or locked with its unlock level.
 * Locked weapons are marked with a lock icon and text, never by colour alone.
 * Used in the pause menu now and on the Dashboard later.
 */
export function Armory({ weapons, level, className = '' }: ArmoryProps) {
  if (!weapons || weapons.length === 0 || level === undefined) return null
  const rows = armoryEntries(weapons, level)
  if (rows.length === 0) return null
  return (
    <section aria-labelledby="armory-title" data-testid="armory" className={`w-full text-left ${className}`.trim()}>
      <h3 id="armory-title" className="mb-1 font-(family-name:--font-label) text-sm uppercase tracking-wide text-ink-muted">
        Armory
      </h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {rows.map((w) => {
          const Icon = w.unlocked ? ICONS[w.id] : Lock
          return (
            <li
              key={w.id}
              data-weapon={w.id}
              data-unlocked={w.unlocked ? 'true' : 'false'}
              className={`flex items-center gap-2 rounded-md border px-2 py-1 text-sm ${
                w.unlocked ? 'border-gold bg-panel text-ink' : 'border-dashed border-ink-muted bg-bg text-ink-muted'
              }`}
            >
              <Icon aria-hidden="true" className={`size-5 shrink-0 ${w.unlocked ? 'text-gold' : ''}`} />
              <span className="min-w-0 flex-1 truncate font-semibold">{w.name}</span>
              <span className="shrink-0 text-xs">
                {w.unlocked ? `Unlocked (level ${w.unlockLevel})` : `Locked: unlocks at level ${w.unlockLevel}`}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
