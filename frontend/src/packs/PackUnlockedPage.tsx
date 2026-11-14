import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Unlock } from 'lucide-react'
import { describeError, getApi } from '../api'
import { HauntedBackdrop } from '../components/HauntedBackdrop'
import { PageShell } from '../components/PageShell'
import type { Pack } from '../types/api'
import '../styles/live.css'
import '../styles/packs.css'
import { SampleChip } from './PackChip'

/** `/packs/unlocked/:packId`: shown after a final boss opens the next pack. Continue opens that pack's floor map. */
export default function PackUnlockedPage() {
  const { packId = '' } = useParams()
  const [pack, setPack] = useState<Pack | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const api = await getApi()
        const res = await api.getPacks()
        const found = res.packs.find((p) => p.id === packId)
        if (cancelled) return
        if (found) setPack(found)
        else setError('That dungeon could not be found.')
      } catch (err) {
        if (!cancelled) setError(describeError(err, 'The dungeon could not be loaded.'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [packId])

  return (
    <PageShell
      title="New dungeon unlocked"
      back={{ to: '/packs', label: 'All dungeons' }}
      className="sd-live sd-haunted"
      decor={<HauntedBackdrop />}
      testId="pack-unlocked-page"
    >
      <div className="sd-live__body">
        <section className="sd-card sd-pack-screen" role="status">
          <Unlock aria-hidden="true" className="sd-pack-screen__burst" size={48} />
          {pack && (
            <>
              <h2 className="sd-card__h" data-testid="unlocked-title">{`Pack ${pack.order}: ${pack.title}`}</h2>
              {pack.sample && <SampleChip />}
              {pack.description && <p className="sd-card__muted">{pack.description}</p>}
              <Link to={`/campaign/${encodeURIComponent(pack.dungeon_id)}`} className="sd-cta" data-testid="unlocked-continue">
                Continue
              </Link>
            </>
          )}
          {error && (
            <>
              <p role="alert">{error}</p>
              <Link to="/packs" className="sd-cta">
                See all dungeons
              </Link>
            </>
          )}
        </section>
      </div>
    </PageShell>
  )
}
