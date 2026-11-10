import { useEffect, useRef } from 'react'
import { sfx } from '../audio/sfx'
import { OverlayFrame } from '../components/OverlayFrame'
import { useReducedMotion } from '../state/useReducedMotion'
import '../styles/haunt.css'

export interface HauntFinaleProps {
  /** Memories laid to rest in this visit (the run summary's correct answers). */
  laidToRest: number
  /** The Backend's daily streak, or null when it could not be fetched (then the line is left out). */
  dailyStreak: number | null
  /** Memories still due after the run, when known. */
  dueLeft: number | null
  onDashboard(): void
  onMap(): void
}

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

/**
 * The end of a Daily Haunt: "N memories laid to rest" and the daily streak, with rising lights.
 * Under reduced motion the lights are a static row and the frame does not animate.
 */
export function HauntFinale({ laidToRest, dailyStreak, dueLeft, onDashboard, onMap }: HauntFinaleProps) {
  const reduced = useReducedMotion()
  const primary = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    sfx.play('finale')
  }, [])
  return (
    <OverlayFrame title="Daily Haunt complete" titleId="haunt-finale-title" describedBy="haunt-finale-count" initialFocus={primary}>
      <div className="sd-finale" data-testid="haunt-finale" data-reduced={reduced ? 'true' : undefined}>
        <div className="sd-finale__wisps" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="sd-finale__wisp" />
          ))}
        </div>
        <p id="haunt-finale-count" className="sd-finale__count" data-testid="haunt-finale-count">
          {`${laidToRest} ${plural(laidToRest, 'memory', 'memories')} laid to rest`}
        </p>
        {dailyStreak !== null && (
          <p className="sd-finale__streak" data-testid="haunt-finale-streak">
            {`Daily streak: ${dailyStreak} ${plural(dailyStreak, 'day', 'days')}`}
          </p>
        )}
        {dueLeft !== null && dueLeft > 0 && (
          <p className="sd-finale__note">{`${dueLeft} more ${plural(dueLeft, 'memory is', 'memories are')} still waiting.`}</p>
        )}
        <div className="sd-finale__actions">
          <button ref={primary} type="button" className="sd-cta" onClick={onDashboard}>
            Back to the dashboard
          </button>
          <button type="button" className="sd-ghost-btn" onClick={onMap}>
            Open the map
          </button>
        </div>
      </div>
    </OverlayFrame>
  )
}
