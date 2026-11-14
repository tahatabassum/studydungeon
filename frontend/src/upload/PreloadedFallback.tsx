import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Skull } from 'lucide-react'
import { getApi } from '../api'
import { resolvePreloadedDungeon } from '../identity/resolvePreloaded'
import { useSession } from '../state/SessionContext'

export const PRELOADED_INSTEAD = 'Play preloaded dungeons instead'

/** "Play preloaded dungeons instead": the same resolver as the path choice (packs, dungeon list, demo session). */
export function PreloadedFallback({ className = 'sd-cta' }: { className?: string }) {
  const navigate = useNavigate()
  const { user, setSession } = useSession()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const go = useCallback(async () => {
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
    <div>
      <button type="button" className={className} onClick={() => void go()} disabled={busy} aria-busy={busy || undefined} data-testid="play-preloaded-instead">
        <Skull aria-hidden="true" size={18} />
        {PRELOADED_INSTEAD}
      </button>
      {failed && (
        <p role="alert" className="sd-up__error">
          We could not reach the preloaded dungeons. Try again.
        </p>
      )}
    </div>
  )
}
