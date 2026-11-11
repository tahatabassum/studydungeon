import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, getApi } from '../api'
import { capabilityOf } from '../api/ApiClient'
import { useSession } from '../state/SessionContext'
import { useStartDemo } from '../state/useStartDemo'
import { GENERIC_GUEST_ERROR, describeGuestError, reasonMessage } from './guestMessages'
import { useWakeFlow } from './useWakeFlow'

export const PAUSED_MESSAGE = 'The dungeon is full for this hour. Try again later, or play the offline demo.'
export const TRY_AGAIN_MESSAGE = 'Something went wrong. Please try again.'

const CAPABILITY_OFF_STATUSES = new Set([404, 405, 501])

/** Seconds to wait, from `retry_after_seconds` first, then the `Retry-After` header (seconds or HTTP date). */
export function retryAfterSeconds(err: ApiError, now: number = Date.now()): number | undefined {
  if (typeof err.retry_after_seconds === 'number' && err.retry_after_seconds > 0) return err.retry_after_seconds
  const raw = err.retryAfter?.trim()
  if (!raw) return undefined
  if (/^\d+$/.test(raw)) return Number(raw) > 0 ? Number(raw) : undefined
  const at = Date.parse(raw)
  if (Number.isNaN(at)) return undefined
  const secs = Math.ceil((at - now) / 1000)
  return secs > 0 ? secs : undefined
}

export interface UseCreateGuest {
  /** Creates the guest. Repeats are ignored while a request is pending. */
  submit(displayName: string): Promise<void>
  pending: boolean
  /** Friendly message of the last failure, if any. */
  error: string | null
  /** The last failure was NAME_INVALID: the form keeps its values. */
  nameInvalid: boolean
  /** 503 GUEST_CREATION_PAUSED: offer the offline demo. */
  paused: boolean
  /** guestIdentity is off (404/405/501): the screen falls back to POST /demo/session. */
  legacy: boolean
  /** Waking screen state (create request or the legacy demo request). */
  offerOffline: boolean
  keptWaiting: boolean
  timedOut: boolean
  keepWaiting(): void
  retry(): Promise<void>
  /** True while the Offline_Demo loads after the player chose it. */
  offlineBusy: boolean
  /** The ONLY way to start the offline demo: called from the player's click. */
  chooseOffline(): Promise<void>
}

/**
 * Name_Screen submit flow (D4, D5, D33). Never starts the Offline_Demo by itself: no timeout, error, 503 or
 * capability change does. A success that arrives while the choices or the timeout error are shown continues to
 * /choose; a late success after the player chose offline is ignored.
 */
export function useCreateGuest(): UseCreateGuest {
  const navigate = useNavigate()
  const { setUser } = useSession()
  const demo = useStartDemo()
  const wake = useWakeFlow()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameInvalid, setNameInvalid] = useState(false)
  const [paused, setPaused] = useState(false)
  const [legacy, setLegacy] = useState(false)
  const [offlineBusy, setOfflineBusy] = useState(false)
  const inFlight = useRef(false)
  const generation = useRef(0)
  const offlineChosen = useRef(false)
  const lastName = useRef('')

  const goLegacy = useCallback(() => {
    setLegacy(true)
    void demo.start() // the waking flow now belongs to the demo request; do not wait for it here
  }, [demo])

  const submit = useCallback(
    async (displayName: string) => {
      if (inFlight.current) return
      if (legacy) {
        void demo.start()
        return
      }
      inFlight.current = true
      offlineChosen.current = false
      lastName.current = displayName
      const mine = ++generation.current
      const current = () => mine === generation.current
      setPending(true)
      setError(null)
      setNameInvalid(false)
      setPaused(false)
      wake.begin()
      let handedOver = false
      try {
        const api = await getApi()
        if (capabilityOf(api, 'guestIdentity') === 'off') {
          handedOver = true
          inFlight.current = false
          setPending(false)
          wake.end()
          goLegacy()
          return
        }
        const res = await api.createGuest({ display_name: displayName, accept_public_notice: true })
        if (!current() || offlineChosen.current) return // a late success after offline (or Retry) is ignored
        setUser(res.user)
        navigate('/choose', { replace: true })
      } catch (err) {
        if (!current() || offlineChosen.current) return
        if (err instanceof ApiError && CAPABILITY_OFF_STATUSES.has(err.status)) {
          handedOver = true
          inFlight.current = false
          setPending(false)
          wake.end()
          goLegacy()
          return
        }
        if (err instanceof ApiError && err.status === 409 && err.code === 'SESSION_EXISTS') {
          try {
            const api = await getApi()
            const me = await api.getMe()
            if (!current() || offlineChosen.current) return
            if (me) {
              setUser(me.user, me.expires_at)
              navigate('/choose', { replace: true })
              return
            }
          } catch {
            // falls through to the generic error
          }
          setError(TRY_AGAIN_MESSAGE)
          return
        }
        if (err instanceof ApiError && err.status === 429) {
          setError(describeGuestError('RATE_LIMIT_EXCEEDED', { retry_after_seconds: retryAfterSeconds(err) }))
          return
        }
        if (err instanceof ApiError && err.code === 'NAME_INVALID') {
          setNameInvalid(true)
          setError(reasonMessage(err.reason))
          return
        }
        if (err instanceof ApiError && (err.code === 'GUEST_CREATION_PAUSED' || err.status === 503)) {
          setPaused(true)
          setError(PAUSED_MESSAGE)
          return
        }
        if (err instanceof ApiError && err.code === 'NOTICE_NOT_ACCEPTED') {
          setError('Something went wrong. Press Accept and continue again.')
          return
        }
        setError(err instanceof ApiError && err.code ? describeGuestError(err.code) : GENERIC_GUEST_ERROR)
      } finally {
        if (!handedOver && current() && !offlineChosen.current) {
          wake.end()
          inFlight.current = false
          setPending(false)
        }
      }
    },
    [legacy, demo, wake, goLegacy, setUser, navigate],
  )

  const retry = useCallback(async () => {
    if (legacy) {
      await demo.retry()
      return
    }
    generation.current += 1 // the old request keeps running but its answer is ignored
    inFlight.current = false
    await submit(lastName.current)
  }, [legacy, demo, submit])

  const chooseOffline = useCallback(async () => {
    if (offlineChosen.current) return
    offlineChosen.current = true
    generation.current += 1
    inFlight.current = false
    wake.end()
    setOfflineBusy(true)
    try {
      // The dynamic import lives in useStartDemo.chooseOffline (the single allowed place).
      await demo.chooseOffline({ force: true })
    } finally {
      setOfflineBusy(false)
      setPending(false)
      offlineChosen.current = false
    }
  }, [demo, wake])

  return {
    submit,
    pending: legacy ? demo.pending : pending,
    error: error ?? demo.error,
    nameInvalid,
    paused,
    legacy,
    offerOffline: legacy ? demo.offerOffline : wake.offerOffline,
    keptWaiting: legacy ? demo.keptWaiting : wake.keptWaiting,
    timedOut: legacy ? demo.timedOut : wake.timedOut,
    keepWaiting: legacy ? demo.keepWaiting : wake.keepWaiting,
    retry,
    offlineBusy,
    chooseOffline,
  }
}
