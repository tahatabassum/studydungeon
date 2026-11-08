import '../styles/hud.css'

export interface HauntedCounterProps {
  /** Reviews due (the backend's due_review_count, minus any rested locally). Negative values show as 0. */
  count: number
  /** Compact top bar: icon and number only (the full label stays for assistive tech). */
  compact?: boolean
  className?: string
}

/** A small code-drawn ghost, decorative. */
function GhostIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none">
      <path
        d="M12 3C8.4 3 6 5.7 6 9v11l2-1.6L10 20l2-1.6L14 20l2-1.6L18 20V9c0-3.3-2.4-6-6-6z"
        fill="currentColor"
        fillOpacity="0.28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="9.7" cy="10" r="1.2" fill="currentColor" />
      <circle cx="14.3" cy="10" r="1.2" fill="currentColor" />
      <path d="M12 13.2c-.9 0-1.4.5-1.4 1.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * "Haunted memories due" counter, shown in the floating HUD and reused by the Dashboard.
 * It is a polite live region so a decrement after a memory is laid to rest is announced.
 */
export function HauntedCounter({ count, compact = false, className = '' }: HauntedCounterProps) {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="haunted-counter"
      data-count={n}
      className={`sd-stone flex items-center gap-1.5 px-2 py-1 text-sm font-semibold text-ink ${className}`.trim()}
    >
      <span className="text-ghost">
        <GhostIcon />
      </span>
      {compact ? (
        <span className="sr-only">Haunted memories due</span>
      ) : (
        <span className="font-label tracking-wide">Haunted memories due</span>
      )}
      <span className="sr-only">:</span>
      <span className="tabular-nums text-ghost">{n}</span>
    </div>
  )
}
