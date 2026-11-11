import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, Skull } from 'lucide-react'
import { getApi } from '../api'
import { capabilityOf } from '../api/ApiClient'
import { HauntedBackdrop } from '../components/HauntedBackdrop'
import { PageShell } from '../components/PageShell'
import { useSession } from '../state/SessionContext'
import { useStartDemo } from '../state/useStartDemo'
import '../styles/live.css'
import { resolvePreloadedDungeon } from './resolvePreloaded'

export const PRELOADED_TITLE = 'Play preloaded dungeons (try the game)'
export const UPLOAD_TITLE = 'Upload my notes (play from your own material)'
export const RESOLVE_ERROR = 'We could not reach the preloaded dungeons. Check your connection and try again.'

/**
 * EXTENSION POINT (Phase 5, Req 5.8): when `uploadQuota` is not off, return the Quota line from the Backend
 * (`getUploadQuota`). That method does not exist yet, so nothing is shown today.
 */
function useUploadQuotaLine(): string | null {
  return null
}

export interface PathChoiceProps {
  /** "full" is the /choose page; "compact" sits inside a Dashboard card. */
  variant?: 'full' | 'compact'
  /** Gives the preloaded card initial focus on mount. Default: on for "full", off for "compact". */
  autoFocus?: boolean
}

/** Two cards: preloaded dungeons (default, recommended, focused) and upload my notes (Req 5, D7). */
export function PathChoice({ variant = 'full', autoFocus }: PathChoiceProps) {
  const navigate = useNavigate()
  const { user, setSession } = useSession()
  const demo = useStartDemo()
  const preloadedRef = useRef<HTMLButtonElement>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const quota = useUploadQuotaLine()
  const [packsOn, setPacksOn] = useState(false)
  useEffect(() => {
    let cancelled = false
    void getApi()
      .then((api) => {
        if (!cancelled) setPacksOn(capabilityOf(api, 'packs') === 'on')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  const compact = variant === 'compact'
  const focusOnMount = autoFocus ?? !compact

  useEffect(() => {
    if (focusOnMount) preloadedRef.current?.focus()
  }, [focusOnMount])

  const openPreloaded = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      const api = await getApi()
      const res = await resolvePreloadedDungeon(api, { hasSession: user !== null })
      if (res.session) setSession(res.session)
      navigate(res.path)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }, [busy, user, setSession, navigate])

  return (
    <div className={`sd-choice${compact ? ' sd-choice--compact' : ''}`} data-testid="path-choice" data-variant={variant}>
      <div className="sd-choice__cards">
        <button
          ref={preloadedRef}
          type="button"
          className="sd-choice__card sd-choice__card--default"
          onClick={() => void openPreloaded()}
          disabled={busy}
          aria-busy={busy || undefined}
          data-testid="choice-preloaded"
        >
          <Skull aria-hidden="true" size={compact ? 18 : 28} />
          <span className="sd-choice__title">{PRELOADED_TITLE}</span>
          {!compact && <span className="sd-choice__desc">Jump in and try the game right away.</span>}
          <span className="sd-choice__tag">Recommended</span>
        </button>
        <button type="button" className="sd-choice__card" onClick={() => navigate('/upload')} data-testid="choice-upload">
          <BookOpen aria-hidden="true" size={compact ? 18 : 28} />
          <span className="sd-choice__title">{UPLOAD_TITLE}</span>
          {!compact && <span className="sd-choice__desc">Turn your own notes into a dungeon.</span>}
          {quota && <span className="sd-choice__quota">{quota}</span>}
        </button>
      </div>
      {packsOn && (
        <p className="sd-choice__more">
          <Link to="/packs" data-testid="choice-packs">
            See all dungeons
          </Link>
        </p>
      )}
      {failed && (
        <div className="sd-choice__error" role="alert" data-testid="choice-error">
          <p>{RESOLVE_ERROR}</p>
          <div className="sd-live__row">
            <button type="button" className="sd-cta" onClick={() => void openPreloaded()} disabled={busy}>
              Retry
            </button>
            <button type="button" className="sd-ghost-btn" onClick={() => void demo.chooseOffline({ force: true })}>
              Play offline demo
            </button>
          </div>
          {demo.error && <p>{demo.error}</p>}
        </div>
      )}
    </div>
  )
}

/** `/choose`: the page after the Name_Screen. */
export default function PathChoicePage() {
  return (
    <PageShell
      title="Choose your path"
      subtitle="Try the game right away, or play from your own notes."
      back={{ to: '/dashboard', label: 'Dashboard' }}
      variant="fit"
      className="sd-live sd-haunted"
      decor={<HauntedBackdrop />}
      testId="choose-page"
    >
      <div className="sd-live__body sd-live__body--wide">
        <PathChoice variant="full" />
      </div>
    </PageShell>
  )
}
