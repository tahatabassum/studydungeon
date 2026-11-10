import { Lock } from 'lucide-react'
import { WEAPON_ICONS as ICONS } from './weaponIcons'
import type { WeaponId } from '@/types/api'
import { setEquippedWeapon, useEquippedWeapon } from './equipped'
import { armoryEntries } from './weapons'

export interface ArmoryProps {
  /** `progress.weapons`: every weapon with its unlock level. Renders nothing when absent or empty. */
  weapons: readonly { id: string; unlock_level: number }[] | undefined
  /** The player's level (`progress.level`). */
  level: number | undefined
  className?: string
  /** Lets the player pick an unlocked weapon (task 13.7). Locked weapons stay disabled. */
  equippable?: boolean
}

/**
 * Lists every weapon from the progress response as unlocked or locked with its unlock level.
 * Locked weapons are marked with a lock icon and text, never by colour alone.
 * Used in the pause menu now and on the Dashboard later.
 */
export function Armory({ weapons, level, className = '', equippable = false }: ArmoryProps) {
  const equipped = useEquippedWeapon()
  if (!weapons || weapons.length === 0 || level === undefined) return null
  const rows = armoryEntries(weapons, level)
  if (rows.length === 0) return null
  return (
    <section aria-labelledby="armory-title" data-testid="armory" className={`w-full text-left ${className}`.trim()}>
      <h3 id="armory-title" className="mb-1 font-(family-name:--font-label) text-sm uppercase tracking-wide text-ink-muted">
        Armory
      </h3>
      {equippable && (
        <p className="mb-1 text-xs text-ink-muted" data-testid="armory-hint">
          {equipped ? 'Your chosen weapon is used for every strike.' : 'Automatic: your best unlocked weapon is used.'}
        </p>
      )}
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
                {w.requirement !== undefined
                  ? w.unlocked
                    ? 'Unlocked'
                    : `Locked: ${w.requirement}`
                  : w.unlocked
                    ? `Unlocked (level ${w.unlockLevel})`
                    : `Locked: unlocks at level ${w.unlockLevel}`}
              </span>
              {equippable && w.unlocked && (
                <button
                  type="button"
                  data-testid={`equip-${w.id}`}
                  aria-pressed={equipped === w.id}
                  aria-label={equipped === w.id ? `Unequip ${w.name}` : `Equip ${w.name}`}
                  onClick={() => setEquippedWeapon(equipped === w.id ? null : (w.id as WeaponId))}
                  className="shrink-0 rounded border border-gold px-2 py-0.5 text-xs font-semibold text-ink hover:bg-bg aria-pressed:bg-gold aria-pressed:text-bg"
                >
                  {equipped === w.id ? 'Equipped' : 'Equip'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
