import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { getApi } from '../api'
import { HauntedBackdrop } from '../components/HauntedBackdrop'
import { PageShell } from '../components/PageShell'
import { hauntPath } from '../haunt/modes'
import '../styles/live.css'
import '../styles/packs.css'

/** `/packs/complete`: every preloaded dungeon is cleared. The Daily Haunt button needs the dailyHaunt capability. */
export default function AllPacksCompletePage() {
  const [hauntDungeon, setHauntDungeon] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const api = await getApi()
        if (api.capabilities?.dailyHaunt === false) return
        const res = await api.getPacks()
        const first = [...res.packs].sort((a, b) => a.order - b.order)[0]
        if (!cancelled && first) setHauntDungeon(first.dungeon_id)
      } catch {
        // No Daily Haunt button without a proven dungeon.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <PageShell
      title="All dungeons conquered"
      subtitle="You cleared every preloaded dungeon."
      back={{ to: '/packs', label: 'All dungeons' }}
      className="sd-live sd-haunted"
      decor={<HauntedBackdrop />}
      testId="pack-complete-page"
    >
      <div className="sd-live__body">
        <section className="sd-card sd-pack-screen" role="status">
          <Trophy aria-hidden="true" className="sd-pack-screen__burst" size={48} />
          <p className="sd-card__muted">Now bring your own notes and fight what you need to learn.</p>
          <div className="sd-live__row">
            <Link to="/upload" className="sd-cta" data-testid="complete-upload">
              Upload my notes
            </Link>
            {hauntDungeon && (
              <Link to={hauntPath(hauntDungeon)} className="sd-ghost-btn" data-testid="complete-haunt">
                Daily Haunt
              </Link>
            )}
          </div>
        </section>
      </div>
    </PageShell>
  )
}
