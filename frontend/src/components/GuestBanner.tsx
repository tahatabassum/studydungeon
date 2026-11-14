import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useReducedMotion } from '@/state/useReducedMotion'
import { UpgradeOffer } from '../identity/UpgradeOffer'
import { Button } from './Button'

export const GUEST_BANNER_MS = 6000
export const GUEST_BANNER_RESUME_MS = 2000
const FADE_MS = 250

export interface GuestBannerProps {
  isGuest: boolean
  /** The player's public handle (displayHandle). The internal guest username must never be passed. */
  handle?: string
  onCreateAccount?: () => void
  /** Auto-hide after a delay (ms). Omit to keep the banner permanently (e.g. landing page). */
  autoHideMs?: number
  /** Called once the banner has been removed (timeout or dismiss). */
  onDone?: () => void
}

export function GuestBanner({ isGuest, handle, onCreateAccount, autoHideMs, onDone }: GuestBannerProps) {
  const reduced = useReducedMotion()
  const [hold, setHold] = useState(false)
  const [delay, setDelay] = useState(autoHideMs ?? 0)
  const [fading, setFading] = useState(false)
  const [gone, setGone] = useState(false)
  const timed = autoHideMs !== undefined

  const remove = () => {
    setGone(true)
    onDone?.()
  }

  // Countdown: paused while hovered/focused, restarted with a shorter delay on leave.
  useEffect(() => {
    if (!timed || !isGuest || hold || gone || fading) return
    const t = setTimeout(() => {
      if (reduced) remove()
      else setFading(true)
    }, delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, isGuest, hold, gone, fading, delay, reduced])

  // Fade-out, then unmount.
  useEffect(() => {
    if (!fading) return
    const t = setTimeout(remove, FADE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fading])

  if (!isGuest || gone) return null

  const enter = () => {
    if (timed) setHold(true)
  }
  const leave = () => {
    if (!timed) return
    setDelay(GUEST_BANNER_RESUME_MS)
    setHold(false)
  }

  return (
    <aside
      aria-label="Guest notice"
      onMouseEnter={enter}
      onMouseLeave={leave}
      onFocus={enter}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) leave()
      }}
      style={{ opacity: fading ? 0 : 1, transition: reduced ? 'none' : `opacity ${FADE_MS}ms ease-out` }}
      className="flex flex-wrap items-center justify-between gap-x-2 rounded-md border border-deep bg-surface-2/80 px-2 py-0.5 text-xs leading-tight text-ink-muted"
    >
      <p role="status" className="min-w-0 truncate">
        {handle ? `Playing as ${handle}. ` : 'Playing as guest. '}Progress is temporary. Create an account to save.
      </p>
      <div className="flex items-center gap-1">
        <UpgradeOffer
          isGuest
          onActivate={onCreateAccount}
          newTab
          className={
            onCreateAccount
              ? 'border-gold! px-3! py-0.5! text-xs! text-gold!'
              : 'shrink-0 rounded-md border border-gold px-2 text-xs font-semibold leading-tight text-gold hover:border-accent hover:text-accent'
          }
          fallback={
            onCreateAccount ? (
              <Button variant="secondary" onClick={onCreateAccount} className="border-gold! px-3! py-0.5! text-xs! text-gold!">
                Create account
              </Button>
            ) : (
              <a
                href="/register"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-md border border-gold px-2 text-xs font-semibold leading-tight text-gold hover:border-accent hover:text-accent"
              >
                Create account
              </a>
            )
          }
        />
        {timed && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={remove}
            className="shrink-0 rounded-md p-0.5 text-ink-muted hover:text-ink"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </aside>
  )
}
