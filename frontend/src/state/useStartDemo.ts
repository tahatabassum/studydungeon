import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, describeError, getApi, setApiOverride } from '../api'
import type { DemoSessionResponse } from '../types/api'
import { useSession } from './SessionContext'

/** After this long without an answer from POST /demo/session the Offline demo is offered (Req 14.2). */
export const OFFLINE_OFFER_MS = 8000

function errorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) return 'Too many demo starts, try again soon.'
  return describeError(err, 'Could not start the demo. Please try again.')
}

export interface UseStartDemo {
  start(): Promise<void>
  pending: boolean
  error: string | null
  /** True once the request has been pending for 8 s: show the Offline demo choice. */
  offerOffline: boolean
  /** The explicit Offline demo choice: loads `src/offline` on demand and starts there. */
  chooseOffline(): Promise<void>
}

/**
 * Starts the demo session and opens the campaign map. Ignores a second call while one is in flight.
 * If the server is slow, `offerOffline` turns on after 8 s while the request keeps running. Once the player
 * chooses Offline, a late answer from the server is ignored.
 */
export function useStartDemo(): UseStartDemo {
  const navigate = useNavigate()
  const { setSession } = useSession()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offerOffline, setOfferOffline] = useState(false)
  const inFlight = useRef(false)
  const offlineChosen = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }, [])
  useEffect(() => clearTimer, [clearTimer])

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
    setPending(true)
    setError(null)
    setOfferOffline(false)
    clearTimer()
    timer.current = setTimeout(() => setOfferOffline(true), OFFLINE_OFFER_MS)
    try {
      const api = await getApi()
      const res = await api.startDemoSession()
      if (offlineChosen.current) return // too late: the player is already offline
      open(res)
    } catch (err) {
      if (!offlineChosen.current) setError(errorMessage(err))
    } finally {
      clearTimer()
      if (!offlineChosen.current) {
        inFlight.current = false
        setPending(false)
        setOfferOffline(false)
      }
    }
  }, [clearTimer, open])

  const chooseOffline = useCallback(async () => {
    if (!inFlight.current || offlineChosen.current) return
    offlineChosen.current = true
    clearTimer()
    setOfferOffline(false)
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
      setPending(false)
    }
  }, [clearTimer, open])

  return { start, pending, error, offerOffline, chooseOffline }
}
