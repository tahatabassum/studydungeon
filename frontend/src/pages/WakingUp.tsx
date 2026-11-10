import { useEffect, useState } from 'react'
import { PixelSprite } from '../components/PixelSprite'
import { Spinner } from '../components/Spinner'
import { CHARACTER_SPRITES } from '../art/sprites'
import '../styles/waking.css'

export const WAKING_TITLE = 'Waking up the dungeon...'
export const TIP_INTERVAL_MS = 4000

/** Spooky study tips shown while the server wakes. Plain text, no pictographs. */
export const WAKING_TIPS: readonly string[] = Object.freeze([
  'Ghosts forget nothing. Review a missed question tomorrow and it will not haunt you again.',
  'A wrong answer is only a monster that has not been defeated yet.',
  'Read the source line after each fight. The page number is your map back to the notes.',
  'Short sessions beat long ones. Even a ghost needs to rest between hauntings.',
  'Keep your streak alive: three right answers in a row land a critical strike.',
  'The Exam Warden only fears students who cleared every floor.',
  'Say the answer out loud before you pick it. Spirits respect a confident voice.',
  'Cobwebs gather on topics you skip. Visit your weak rooms first.',
])

export interface WakingUpProps {
  /** After 8 s without an answer the Offline demo is offered while the request keeps going. */
  offerOffline: boolean
  onOffline: () => void
  /** Disables the Offline button while it loads. */
  offlineBusy?: boolean
}

/** Full-screen "Waking up the dungeon..." state with rotating tips and, late, the Offline demo choice. */
export function WakingUp({ offerOffline, onOffline, offlineBusy = false }: WakingUpProps) {
  const [tip, setTip] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTip((i) => (i + 1) % WAKING_TIPS.length), TIP_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="sd-waking" data-testid="waking-up" role="dialog" aria-modal="true" aria-labelledby="sd-waking-title">
      <div className="sd-waking__card">
        <PixelSprite map={CHARACTER_SPRITES.friendly_ghost} scale={5} className="sd-waking__ghost" />
        <h2 id="sd-waking-title" className="sd-waking__title">
          {WAKING_TITLE}
        </h2>
        <div className="sd-waking__spinner">
          <Spinner label="Loading" />
        </div>
        <p className="sd-waking__tip" role="status" aria-live="polite" data-testid="waking-tip">
          {WAKING_TIPS[tip]}
        </p>
        {offerOffline && (
          <div className="sd-waking__offline" data-testid="waking-offline">
            <p className="sd-waking__note">The server is taking its time. It may still answer; you do not have to wait.</p>
            <button type="button" className="sd-ghost-btn" onClick={onOffline} disabled={offlineBusy}>
              Play the offline demo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
