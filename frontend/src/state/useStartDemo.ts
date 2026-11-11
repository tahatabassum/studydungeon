import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, describeError, getApi, setApiOverride } from '../api'
import { OFFLINE_OFFER_MS } from '../identity/wakeConstants'
import { useWakeFlow } from '../identity/useWakeFlow'
import type { DemoSessionResponse } from '../types/api'
import { useSession } from './SessionContext'

/** After this long without an answer the Offline demo is offered (Req 14.2, frontend-10 2.15). Lives in identity/wakeConstants. */
export { OFFLINE_OFFER_MS }

function errorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) return 'Too many demo starts, try again soon.'
  return describeError(err, 'Could not start the demo. Please try again.')
}

export interface UseStartDemo {
  start(): Promise<void>
  pending: boolean
  error: string | null
  /** True once the request has been pending for 8 s: show "Keep waiting" and "Play offline demo". */
  offerOffline: boolean
  /** The player chose "Keep waiting": the request stays alive and the tips keep rotating. */
  keptWaiting: boolean
  /** True after WAKE_MAX_MS without an answer: show a friendly error with Retry and the offline choice. */
  timedOut: boolean
  /** "Keep waiting" (D33). */
  keepWaiting(): void
  /** Sends a new request after a timeout; a late answer of the old one is ignored. */
  retry(): Promise<void>
  /**
   * The explicit Offline demo choice: loads `src/offline` on demand and starts there. With `force` it also works
   * when no demo request is in flight (used by the Name_Screen, which owns its own request).
   */
  chooseOffline(options?: { force?: boolean }): Promise<void>
}

/**
 * Starts the demo session and opens the campaign map. Ignores a second call while one is in flight.
 * If the server is slow, `offerOffline` turns on after 8 s while the request keeps running; "Keep waiting" keeps it
 * alive until WAKE_MAX_MS. Nothing here starts the Offline demo by itself. Once the player chooses Offline, a late
 * answer from the server is ignored.
 */
export function useStartDemo(): UseStartDemo {
  const navigate = useNavigate()
  const { setSession } = useSession()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wake = useWakeFlow()
  const inFlight = useRef(false)
  const offlineChosen = useRef(false)
  const generation = useRef(0)

  const open = useCallback(
    (res: DemoSessionResponse) => {
      setSession(res)
      navigate(`/campaign/${encodeURIComponent(res.dungeon_id)}`)
    },
    [navigate, setSession],
  )

  const start = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    offlineChosen.current = false
    const mine = ++generation.current
    setPending(true)
    setError(null)
    wake.begin()
    try {
      const api = await getApi()
      const res = await api.startDemoSession()
      if (offlineChosen.current || mine !== generation.current) return // too late: offline chosen or superseded
      open(res)
    } catch (err) {
      if (!offlineChosen.current && mine === generation.current) setError(errorMessage(err))
    } finally {
      if (!offlineChosen.current && mine === generation.current) {
        wake.end()
        inFlight.current = false
        setPending(false)
      }
    }
  }, [wake, open])

  const retry = useCallback(async () => {
    generation.current += 1
    inFlight.current = false
    await start()
  }, [start])

  const chooseOffline = useCallback(
    async (options?: { force?: boolean }) => {
      if (offlineChosen.current) return
      if (!inFlight.current && options?.force !== true) return
      offlineChosen.current = true
      inFlight.current = true
      generation.current += 1
      wake.end()
      setError(null)
      try {
        // The only place that loads the Offline_Module (D15): a dynamic import, never a static one.
        const { createOfflineAdapter } = await import('@/offline')
        const adapter = createOfflineAdapter()
        setApiOverride(adapter)
        open(await adapter.startDemoSession())
      } catch (err) {
        setApiOverride(null)
        setError(errorMessage(err))
      } finally {
        inFlight.current = false
        offlineChosen.current = false
        setPending(false)
      }
    },
    [wake, open],
  )

  return {
    start,
    pending,
    error,
    offerOffline: wake.offerOffline,
    keptWaiting: wake.keptWaiting,
    timedOut: wake.timedOut,
    keepWaiting: wake.keepWaiting,
    retry,
    chooseOffline,
  }
}
