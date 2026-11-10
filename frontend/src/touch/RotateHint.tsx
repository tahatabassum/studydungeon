import { useSyncExternalStore } from 'react'
import '../styles/touch.css'

const QUERY = '(orientation: portrait)'

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const mql = window.matchMedia(QUERY)
  mql.addEventListener?.('change', cb)
  return () => mql.removeEventListener?.('change', cb)
}

function snapshot(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches
}

export interface RotateHintProps {
  onDismiss: () => void
}

/** Dismissible portrait hint. Play works either way. Renders only in portrait. */
export function RotateHint({ onDismiss }: RotateHintProps) {
  const portrait = useSyncExternalStore(subscribe, snapshot, () => false)
  if (!portrait) return null
  return (
    <div className="sd-rotate" role="status" data-testid="rotate-hint">
      <span>Rotate your phone for the best view</span>
      <button type="button" className="sd-rotate__close" onClick={onDismiss} aria-label="Dismiss rotate hint">
        Got it
      </button>
    </div>
  )
}
