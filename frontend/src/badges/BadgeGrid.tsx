import type { CSSProperties } from 'react'
import { Lock } from 'lucide-react'
import '../styles/badges.css'
import type { BadgeId } from '../types/api'
import { BADGES, badgeInfo } from './badges'

export interface BadgeGridProps {
  /** Earned badge ids. Absent means none. */
  earned?: readonly string[] | undefined
  /** Show every catalog badge, locked ones dimmed with a lock (default). False lists only the earned ones. */
  showLocked?: boolean
  /** Smaller medals for table rows. */
  compact?: boolean
  /** Unlock flourish for earned medals (a short pop and glint). Static when false or under reduced motion. */
  flourish?: boolean
  className?: string
}

/**
 * Badge medals. Earned badges are lit and named; locked ones carry a lock icon and the word "Locked",
 * so state never depends on colour alone.
 */
export function BadgeGrid({ earned, showLocked = true, compact = false, flourish = false, className = '' }: BadgeGridProps) {
  const have = new Set(earned ?? [])
  const items = showLocked ? BADGES : BADGES.filter((b) => have.has(b.id))
  if (items.length === 0) return null
  return (
    <ul
      aria-label="Badges"
      data-testid="badge-grid"
      data-flourish={flourish ? 'true' : undefined}
      className={`sd-badge-grid m-0 grid list-none gap-2 p-0 ${compact ? 'grid-cols-4' : ''} ${className}`.trim()}
    >
      {items.map((b, index) => {
        const got = have.has(b.id)
        const Icon = got ? b.icon : Lock
        return (
          <li
            key={b.id}
            data-badge={b.id}
            data-earned={got ? 'true' : 'false'}
            style={{ '--i': index } as CSSProperties}
            title={`${b.label}: ${b.hint}`}
            className={`sd-badge ${got ? 'sd-badge--earned' : 'sd-badge--locked'}`}
          >
            <span className="sd-badge__medal" aria-hidden="true">
              <Icon size={compact ? 16 : 22} />
            </span>
            <span className="sd-badge__label">{b.label}</span>
            <span className="sr-only">{got ? ': earned' : ': locked'}</span>
            {!compact && <span className="sd-badge__hint">{got ? 'Earned' : b.hint}</span>}
          </li>
        )
      })}
    </ul>
  )
}

export interface BadgeIconsProps {
  ids: readonly BadgeId[]
  max?: number
}

/** A row of small badge icons for a leaderboard row (names in the accessible text). */
export function BadgeIcons({ ids, max = 4 }: BadgeIconsProps) {
  const known = ids.map(badgeInfo).filter((b): b is NonNullable<typeof b> => b !== undefined)
  if (known.length === 0) return <span className="text-ink-muted">None</span>
  const shown = known.slice(0, max)
  const extra = known.length - shown.length
  return (
    <span className="inline-flex items-center gap-1" data-testid="badge-icons">
      {shown.map((b) => {
        const Icon = b.icon
        return (
          <span key={b.id} title={b.label} className="sd-badge__mini">
            <Icon aria-hidden="true" size={14} />
            <span className="sr-only">{b.label}</span>
          </span>
        )
      })}
      {extra > 0 && <span className="text-xs text-ink-muted">{`+${extra}`}</span>}
    </span>
  )
}
