import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { describeError, getApi } from '../api'
import { HauntedBackdrop } from '../components/HauntedBackdrop'
import { PageShell } from '../components/PageShell'
import { Spinner } from '../components/Spinner'
import type { PacksResponse } from '../types/api'
import '../styles/live.css'
import '../styles/packs.css'
import { PackChip, SampleChip } from './PackChip'

export const LOCKED_TEXT = "Clear the previous dungeon's final boss to unlock"

/** `/packs`: the preloaded dungeons in order, with status, progress and points. */
export default function PacksPage() {
  const location = useLocation()
  const notice = (location.state as { packLocked?: string } | null)?.packLocked ?? null
  const [data, setData] = useState<PacksResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => {
    setError(null)
    setNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const api = await getApi()
        const res = await api.getPacks()
        if (!cancelled) setData(res)
      } catch (err) {
        if (!cancelled) setError(describeError(err, 'The dungeons could not be loaded.'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [nonce])

  const packs = data ? [...data.packs].sort((a, b) => a.order - b.order) : []
  return (
    <PageShell
      title="Preloaded dungeons"
      subtitle="Clear each dungeon's final boss to open the next one."
      back={{ to: '/dashboard', label: 'Dashboard' }}
      className="sd-live sd-haunted"
      decor={<HauntedBackdrop />}
      testId="packs-page"
    >
      <div className="sd-live__body sd-live__body--wide">
        {notice && (
          <p role="alert" className="sd-live__hint" data-testid="pack-locked-notice">
            {notice}
          </p>
        )}
        {error && (
          <div role="alert" className="sd-choice__error">
            <p>{error}</p>
            <button type="button" className="sd-cta" onClick={retry}>
              Retry
            </button>
          </div>
        )}
        {!data && !error && (
          <p className="sd-card__muted">
            <Spinner label="Loading dungeons" /> Loading dungeons...
          </p>
        )}
        {data && (
          <ol className="sd-packs" aria-label="Preloaded dungeons">
            {packs.map((p) => {
              const playable = p.status === 'available' || p.status === 'in_progress'
              return (
                <li key={p.id} className="sd-card sd-pack" data-testid="pack-card" data-status={p.status}>
                  <h2 className="sd-card__h">
                    <span className="sd-pack__num">{p.order}</span> {p.title}
                  </h2>
                  <div className="sd-pack__chips">
                    <PackChip status={p.status} />
                    {p.sample && <SampleChip />}
                  </div>
                  {p.description && <p className="sd-card__muted">{p.description}</p>}
                  <p className="sd-pack__stats">
                    <span data-testid="pack-floors">{`${p.floors_cleared} of ${p.floors_total} floors cleared`}</span>
                    <span data-testid="pack-points">{`${p.points_earned} points`}</span>
                  </p>
                  {p.status === 'locked' && (
                    <p className="sd-card__muted" data-testid="pack-locked-text">
                      <Lock aria-hidden="true" size={14} /> {LOCKED_TEXT}
                    </p>
                  )}
                  {playable && (
                    <Link to={`/campaign/${encodeURIComponent(p.dungeon_id)}`} className="sd-cta" data-testid="pack-play">
                      Play
                    </Link>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </PageShell>
  )
}
