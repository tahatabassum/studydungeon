import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApi } from '../api'
import { capabilityOf } from '../api/ApiClient'
import { HauntedBackdrop } from '../components/HauntedBackdrop'
import { PageShell } from '../components/PageShell'
import { WakingUp } from '../pages/WakingUp'
import { useSession } from '../state/SessionContext'
import type { NameReason } from '../types/api'
import '../styles/live.css'
import { reasonMessage } from './guestMessages'
import { checkLocalName } from './nameRules'
import { randomSpookyName, rollAnother } from './spookyNames'
import { useCreateGuest } from './useCreateGuest'

export const NAME_CHECK_DEBOUNCE_MS = 500
export const PUBLIC_NOTICE = 'Your name and points appear on the public leaderboard.'
export const REAL_NAME_NOTICE = 'Do not use your real full name.'

interface ServerVerdict {
  value: string
  ok: boolean
  reason?: NameReason
}

/** `/play-as-guest`: pick a Display_Name, accept the public notice and become a Guest (Req 2). */
export default function NameScreen() {
  const navigate = useNavigate()
  const { user, setUser } = useSession()
  // Only a session that exists on arrival redirects. A session created by this page (legacy demo, offline)
  // navigates on its own and must not be overridden.
  const [hadSession] = useState(() => user !== null)
  const create = useCreateGuest()
  const hintId = useId()
  const noticeId = useId()
  const [name, setName] = useState(() => randomSpookyName())
  const [verdict, setVerdict] = useState<ServerVerdict | null>(null)
  const [liveChecksOff, setLiveChecksOff] = useState(false)
  const [namesUnavailable, setNamesUnavailable] = useState(false)
  const [tick, setTick] = useState(0)
  const checkInFlight = useRef(false)
  const lastChecked = useRef<string | null>(null)

  const local = checkLocalName(name)
  const localName = local.ok ? local.name : null

  // Redirect when a session exists (context first, then the server) and warm the server up once.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const api = await getApi()
        void api.warmUp?.()
        if (capabilityOf(api, 'guestIdentity') === 'off') setNamesUnavailable(true)
        if (typeof api.getMe !== 'function') return
        const me = await api.getMe()
        if (cancelled || !me) return
        setUser(me.user, me.expires_at)
        navigate('/choose', { replace: true })
      } catch {
        // Offline or asleep: stay on the form.
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (hadSession) navigate('/choose', { replace: true })
  }, [hadSession, navigate])

  // Debounced server check (D6): local rules pass, value changed, one in flight, any error turns it off.
  useEffect(() => {
    if (liveChecksOff || localName === null || localName === lastChecked.current || checkInFlight.current) return
    const value = localName
    const timer = setTimeout(() => {
      checkInFlight.current = true
      lastChecked.current = value
      void (async () => {
        try {
          const api = await getApi()
          const res = await api.checkGuestName(value)
          setVerdict({ value, ok: res.ok, reason: res.reason })
        } catch {
          setLiveChecksOff(true)
          try {
            const api = await getApi()
            if (capabilityOf(api, 'guestIdentity') === 'off') setNamesUnavailable(true)
          } catch {
            // ignore
          }
        } finally {
          checkInFlight.current = false
          setTick((n) => n + 1)
        }
      })()
    }, NAME_CHECK_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [localName, liveChecksOff, tick])

  const serverRefused = verdict !== null && !verdict.ok && verdict.value === localName
  const hint = !local.ok ? local.message : serverRefused ? reasonMessage(verdict.reason) : null
  const unavailable = create.legacy || namesUnavailable
  const canSubmit = unavailable || (local.ok && !serverRefused)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (create.pending || !canSubmit) return
    if (unavailable) void create.submit('')
    else if (localName !== null) void create.submit(localName)
  }

  if (hadSession) return null

  const waking = create.pending && (create.offerOffline || create.timedOut)

  return (
    <PageShell
      title="Name your hero"
      subtitle={unavailable ? 'Names are not available yet. You can still try the demo.' : 'Pick a name for the leaderboard, or roll a spooky one.'}
      back={{ to: '/', label: 'Back' }}
      variant="fit"
      className="sd-live sd-haunted"
      decor={<HauntedBackdrop />}
      testId="name-screen"
    >
      <div className="sd-live__body">
        <form className="sd-live__form sd-glass-form" onSubmit={onSubmit} noValidate>
          {!unavailable && (
            <>
              <label className="sd-live__label" htmlFor="display-name">
                Display name
              </label>
              <div className="sd-live__row">
                <input
                  id="display-name"
                  name="display_name"
                  className="sd-live__input"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={hint ? true : undefined}
                  aria-describedby={hint ? `${hintId} ${noticeId}` : noticeId}
                />
                <button type="button" className="sd-ghost-btn" onClick={() => setName((n) => rollAnother(n))}>
                  Roll another
                </button>
              </div>
              <p id={hintId} className="sd-live__hint" role={hint ? 'alert' : undefined}>
                {hint}
              </p>
              <div id={noticeId} className="sd-live__notice">
                <p>{PUBLIC_NOTICE}</p>
                <p className="sd-live__note">{REAL_NAME_NOTICE}</p>
              </div>
            </>
          )}
          <button type="submit" className="sd-cta sd-live__submit" disabled={!canSubmit || create.pending}>
            {create.pending ? 'Opening the gates...' : unavailable ? 'Start the demo' : 'Accept and continue'}
          </button>
          {create.error && !waking && (
            <p className="sd-live__error" role="alert" data-testid="create-error">
              {create.error}
            </p>
          )}
          {create.paused && !waking && (
            <button type="button" className="sd-ghost-btn" onClick={() => void create.chooseOffline()} disabled={create.offlineBusy}>
              Play offline demo
            </button>
          )}
        </form>
      </div>
      {waking && (
        <WakingUp
          offerOffline={create.offerOffline}
          onOffline={() => void create.chooseOffline()}
          offlineBusy={create.offlineBusy}
          onKeepWaiting={create.keepWaiting}
          keptWaiting={create.keptWaiting}
          timedOut={create.timedOut}
          onRetry={() => void create.retry()}
        />
      )}
    </PageShell>
  )
}
