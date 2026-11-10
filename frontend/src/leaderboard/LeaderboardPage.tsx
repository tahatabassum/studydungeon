import { useMemo, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Hourglass, Trophy, UserPlus } from 'lucide-react'
import '../styles/leaderboard.css'
import { PageShell } from '../components/PageShell'
import { useSession } from '../state/SessionContext'
import { useProgress } from '../state/useProgress'
import { useLeaderboardSupport } from '../state/useLeaderboardSupport'
import type { LeaderboardPeriod } from '../types/api'
import { DEMO_DUNGEON_ID } from './constants'
import { Podium } from './Podium'
import type { PlayerRun } from './provisional'
import { Row, RowHead } from './Row'
import { bestFinishedRun, useFinishedRuns } from './sessionRuns'
import { useLeaderboard } from './useLeaderboard'
import { buildBoardView, DEFAULT_LIMIT } from './view'

const TABS: ReadonlyArray<{ id: LeaderboardPeriod; label: string }> = [
  { id: 'all', label: 'All-time' },
  { id: 'week', label: 'This week' },
]

export const CLAIM_SPOT = 'Create an account to claim your spot'

function Skeleton() {
  return (
    <div className="sd-lb__skeleton" role="status" aria-live="polite" aria-label="Loading the leaderboard" data-testid="lb-skeleton">
      <div className="sd-lb__skel-podium" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="sd-skel" style={{ height: 120 - i * 18 }} />
        ))}
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="sd-skel" style={{ height: 44 }} />
        ))}
      </div>
      <span className="sr-only">Loading the leaderboard</span>
    </div>
  )
}

function Notice({ icon, title, children, tone = 'default' }: { icon: ReactNode; title: string; children?: ReactNode; tone?: 'default' | 'alert' }) {
  return (
    <section className={`sd-card sd-lb__notice ${tone === 'alert' ? 'sd-card--alert' : ''}`.trim()}>
      <div className="sd-lb__notice-icon" aria-hidden="true">
        {icon}
      </div>
      <h2 className="sd-lb__notice-title">{title}</h2>
      {children}
    </section>
  )
}

/** `/leaderboard`: readable by guests (Req 11.1). The Demo_Board is the main board. */
export default function LeaderboardPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { user } = useSession()
  const support = useLeaderboardSupport()
  const period: LeaderboardPeriod = params.get('period') === 'week' ? 'week' : 'all'
  const dungeonId = params.get('dungeon') ?? DEMO_DUNGEON_ID
  const isDemo = dungeonId === DEMO_DUNGEON_ID
  const isGuest = !user || user.is_guest

  const board = useLeaderboard({ dungeonId, period, limit: DEFAULT_LIMIT, enabled: support === 'yes' })
  const { progress } = useProgress()
  const runs = useFinishedRuns()

  const myRun = useMemo<PlayerRun | null>(() => {
    const best = bestFinishedRun(runs, dungeonId)
    if (!best) return null
    return {
      display_name: user?.username ?? 'You',
      level: progress?.level ?? 1,
      score: best.score,
      accuracy: best.accuracy,
      best_streak: best.bestStreak,
      is_guest: isGuest,
    }
  }, [runs, dungeonId, user?.username, progress?.level, isGuest])

  const view = useMemo(
    () => (board.data ? buildBoardView(board.data, { limit: DEFAULT_LIMIT, run: myRun }) : null),
    [board.data, myRun],
  )

  const selectPeriod = (next: LeaderboardPeriod) => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'all') p.delete('period')
        else p.set('period', next)
        return p
      },
      { replace: true },
    )
  }
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const i = TABS.findIndex((t) => t.id === period)
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length
    selectPeriod(TABS[next].id)
    document.getElementById(`lb-tab-${TABS[next].id}`)?.focus()
  }

  const total = view ? view.podium.length + view.rows.length : 0
  const sessionHome = user ? '/dashboard' : '/'

  return (
    <PageShell
      wide
      testId="leaderboard-page"
      title="Leaderboard"
      subtitle={isDemo ? 'The demo board: Computer Basics Crypt' : 'Your best runs in this dungeon'}
      back={{ to: sessionHome, label: user ? 'Dashboard' : 'Title screen' }}
      actions={
        <Link to="/dashboard" className="sd-page__link">
          Dashboard
        </Link>
      }
    >
      {support === 'no' && (
        <Notice icon={<Hourglass size={34} />} title="The leaderboard is coming soon">
          <p className="sd-card__muted" data-testid="lb-coming-soon">
            The backend does not offer a leaderboard yet. Your runs are still counted, and the board will open here when it
            does.
          </p>
        </Notice>
      )}

      {support !== 'no' && (
        <>
          <div role="tablist" aria-label="Time range" className="sd-lb__tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                id={`lb-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={period === t.id}
                aria-controls="lb-panel"
                tabIndex={period === t.id ? 0 : -1}
                className="sd-lb__tab"
                onClick={() => selectPeriod(t.id)}
                onKeyDown={onTabKey}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div id="lb-panel" role="tabpanel" aria-labelledby={`lb-tab-${period}`} className="sd-lb__panel">
            {(support === 'unknown' || board.status === 'loading') && <Skeleton />}

            {support === 'yes' && board.status === 'error' && (
              <Notice icon={<AlertTriangle size={34} />} title="The board could not be loaded" tone="alert">
                <p role="alert" className="sd-card__muted">
                  {board.error}
                </p>
                <button type="button" className="sd-ghost-btn" onClick={board.refresh}>
                  Retry
                </button>
              </Notice>
            )}

            {support === 'yes' && board.status === 'ready' && view && total === 0 && !view.meRow && (
              <Notice icon={<Trophy size={34} />} title={isDemo ? 'No one is on the board yet' : 'No runs yet'}>
                <p className="sd-card__muted" data-testid="lb-empty">
                  {isDemo ? 'Finish a run to be the first.' : 'Finish a run in this dungeon to see your best scores here.'}
                </p>
                <Link to="/dashboard" className="sd-cta">
                  Start a run
                </Link>
              </Notice>
            )}

            {support === 'yes' && board.status === 'ready' && view && (total > 0 || view.meRow) && (
              <>
                {board.stale && (
                  <p role="status" className="sd-lb__stale">
                    Could not refresh. Showing the last results.
                  </p>
                )}
                <Podium rows={view.podium} />
                {view.rows.length > 0 && (
                  <div className="sd-lb__tablewrap">
                    <table className="sd-lb__table" aria-label={`${period === 'week' ? 'This week' : 'All-time'} rankings`}>
                      <RowHead />
                      <tbody>
                        {view.rows.map((r) => (
                          <Row key={r.entry.id} row={r} provisional={r.isMe && view.meRow?.provisional === true} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {view.meRow && (
                  <section className="sd-lb__pinned" aria-label="Your position" data-testid="lb-me">
                    <table className="sd-lb__table sd-lb__table--pinned">
                      <tbody>
                        <Row row={view.meRow} provisional={view.meRow.provisional} />
                      </tbody>
                    </table>
                  </section>
                )}

                {isGuest && (
                  <section className="sd-card sd-lb__claim" data-testid="lb-claim">
                    <p className="sd-card__text">
                      <strong>{CLAIM_SPOT}</strong>
                      {view.meRow ? `. You are at rank ${view.meRow.rank} for now.` : '. Finish a run to get a provisional rank.'}
                    </p>
                    <button type="button" className="sd-cta" onClick={() => navigate('/register')}>
                      <UserPlus aria-hidden="true" size={18} />
                      Create account
                    </button>
                  </section>
                )}

                <p className="sd-lb__foot">
                  Refreshes every 30 seconds while this page is open.
                  {board.data ? ` Updated ${new Date(board.data.updated_at).toLocaleTimeString('en-US')}.` : ''}
                </p>
              </>
            )}
          </div>
        </>
      )}
    </PageShell>
  )
}
