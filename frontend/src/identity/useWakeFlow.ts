import { useCallback, useEffect, useRef, useState } from 'react'
import { OFFLINE_OFFER_MS, WAKE_MAX_MS } from './wakeConstants'

export interface WakeFlow {
  /** True from OFFLINE_OFFER_MS after the request started: show "Keep waiting" / "Play offline demo". */
  offerOffline: boolean
  /** The player chose "Keep waiting". */
  keptWaiting: boolean
  /** True WAKE_MAX_MS after the request started and still pending: show the friendly error. */
  timedOut: boolean
  /** Starts both timers (measured from now). */
  begin(): void
  /** Stops the timers and resets every flag. */
  end(): void
  keepWaiting(): void
}

/**
 * The waking timers of D33, shared by useCreateGuest and useStartDemo. It only sets flags: it never aborts a
 * request and never starts the Offline_Demo.
 */
export function useWakeFlow(): WakeFlow {
  const [offerOffline, setOfferOffline] = useState(false)
  const [keptWaiting, setKeptWaiting] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const offerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (offerTimer.current !== null) clearTimeout(offerTimer.current)
    if (maxTimer.current !== null) clearTimeout(maxTimer.current)
    offerTimer.current = null
    maxTimer.current = null
  }, [])
  useEffect(() => clear, [clear])

  const end = useCallback(() => {
    clear()
    setOfferOffline(false)
    setKeptWaiting(false)
    setTimedOut(false)
  }, [clear])

  const begin = useCallback(() => {
    end()
    offerTimer.current = setTimeout(() => setOfferOffline(true), OFFLINE_OFFER_MS)
    maxTimer.current = setTimeout(() => setTimedOut(true), WAKE_MAX_MS)
  }, [end])

  const keepWaiting = useCallback(() => setKeptWaiting(true), [])

  return { offerOffline, keptWaiting, timedOut, begin, end, keepWaiting }
}
