import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Trophy } from 'lucide-react'
import { getApi } from '../api'
import { WakingUp } from './WakingUp'
import '../styles/dashboard.css'
import { PageShell } from '../components/PageShell'
import { ArmoryCard, BadgesCard, CardSkeleton, HauntCard, LevelCard, ProgressErrorCard, RecentRunsCard, SessionRunsList } from '../dashboard/ProgressCards'
import { ContinueCard, DemoCard, GuestStatsCard, LinksCard, MasteryCard } from '../dashboard/CampaignCards'
import { LeaderboardPreviewCard } from '../dashboard/BoardCards'
import { ProgressPanel } from '../learning/ProgressPanel'
import { useDashboardDungeon } from '../dashboard/useDashboardDungeon'
import { DEMO_DUNGEON_ID } from '../leaderboard/constants'
import type { PlayerRun } from '../leaderboard/provisional'
import { bestFinishedRun, useFinishedRuns } from '../leaderboard/sessionRuns'
import { useLeaderboard } from '../leaderboard/useLeaderboard'
import { buildBoardView } from '../leaderboard/view'
import { useSession } from '../state/SessionContext'
import { useLeaderboardSupport } from '../state/useLeaderboardSupport'
import { useProgress } from '../state/useProgress'
import { useStartDemo } from '../state/useStartDemo'

export interface DashboardPageProps {
  /** Slot for the Daily Haunt button that frontend-08 Phase 3 adds. Rendered in the Dungeon card when given. */
  dailyHauntSlot?: ReactNode
}

/** `/dashboard`: the home screen. A guest sees the demo card, provisional stats and a Create account call to action. */
export default function DashboardPage({ dailyHauntSlot }: DashboardPageProps = {}) {
  const navigate = useNavigate()
  const { user, dungeonId: sessionDungeonId, clearSession } = useSession()
  const isGuest = !user || user.is_guest
  const demo = useStartDemo()
  const support = useLeaderboardSupport()
  const progressState = useProgress()
  const dungeonId = sessionDungeonId
  const dungeon = useDashboardDungeon(dungeonId)
  const runs = useFinishedRuns()
  const board = useLeaderboard({ dungeonId: DEMO_DUNGEON_ID, period: 'all', limit: 20, enabled: support === 'yes', intervalMs: 0 })

  const progress = progressState.progress
  const best = bestFinishedRun(runs, DEMO_DUNGEON_ID)
  const myRun = useMemo<PlayerRun | null>(
    () =>
      best
        ? {
            display_name: user?.username ?? 'You',
            level: progress?.level ?? 1,
            score: best.score,
            accuracy: best.accuracy,
            best_streak: best.bestStreak,
            is_guest: isGuest,
          }
        : null,
    [best, user?.username, progress?.level, isGuest],
  )
  const view = useMemo(() => (board.data ? buildBoardView(board.data, { limit: 5, run: myRun }) : null), [board.data, myRun])
  const myRank = view?.meRow?.rank ?? null

  const preview = (
    <LeaderboardPreviewCard support={support} status={board.status} error={board.error} view={view} onRetry={board.refresh} />
  )
  const toRegister = () => navigate('/register')

  const [loggingOut, setLoggingOut] = useState(false)
  // Ends the cookie session on the server, then clears the in-memory session. A failed call still signs out locally.
  async function logOut() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const api = await getApi()
      await api.logout()
    } catch {
      // The cookie may already be gone; leaving is still right.
    } finally {
      clearSession()
      navigate('/')
    }
  }

  return (
    <PageShell
      wide
      testId="dashboard-page"
      title="Dashboard"
      subtitle={isGuest ? 'Playing as a guest' : `Welcome back, ${user?.username}`}
      back={{ to: '/', label: 'Title screen' }}
      actions={
        <>
          {dungeonId && (
            <Link to={`/campaign/${encodeURIComponent(dungeonId)}`} className="sd-page__link">
              Map
            </Link>
          )}
          <Link to="/leaderboard" className="sd-page__link">
            <Trophy aria-hidden="true" size={14} />
            Leaderboard
          </Link>
          {!isGuest && (
            <button type="button" className="sd-page__link" onClick={() => void logOut()} disabled={loggingOut}>
              <LogOut aria-hidden="true" size={14} />
              Log out
            </button>
          )}
        </>
      }
    >
      {demo.pending && <WakingUp offerOffline={demo.offerOffline} onOffline={() => void demo.chooseOffline()} />}
      {!isGuest ? (
        <div className="sd-dash" data-view="player">
          {progressState.status === 'error' && <ProgressErrorCard error={progressState.error} onRetry={progressState.retry} />}
          {progressState.status === 'loading' && <CardSkeleton label="your level" rows={2} />}
          {progress && <LevelCard progress={progress} />}

          <ContinueCard
            dungeonId={dungeonId}
            dungeon={dungeon}
            onPlayDemo={() => void demo.start()}
            demoPending={demo.pending}
            demoError={demo.error}
            dailyHauntSlot={dailyHauntSlot}
          />

          {preview}

          {progressState.status === 'loading' ? (
            <CardSkeleton label="recent runs" />
          ) : (
            progress && <RecentRunsCard runs={progress.recent_runs ?? []} />
          )}

          {progress && <HauntCard count={progress.due_review_count ?? 0} />}
          {progress && <ProgressPanel progress={progress} />}
          <LinksCard />

          {dungeonId && <MasteryCard dungeon={dungeon} />}

          {progress && <BadgesCard earned={progress.badges} className="sd-dash__span2" />}
          {progress && <ArmoryCard weapons={progress.weapons} level={progress.level} />}
        </div>
      ) : (
        <div className="sd-dash" data-view="guest">
          <DemoCard onPlayDemo={() => void demo.start()} pending={demo.pending} error={demo.error} dailyHauntSlot={dailyHauntSlot} />
          <GuestStatsCard runs={runs} best={best} rank={myRank} onCreateAccount={toRegister} />
          {preview}
          {progress && <ProgressPanel progress={progress} />}
          <section className="sd-card" aria-labelledby="dash-guest-runs">
            <h2 id="dash-guest-runs" className="sd-card__h">
              Recent runs
            </h2>
            {runs.length === 0 ? <p className="sd-card__muted">Runs you finish in this tab show up here.</p> : <SessionRunsList runs={runs} />}
          </section>
          {dungeonId && <MasteryCard dungeon={dungeon} />}
          <BadgesCard earned={[]} />
        </div>
      )}
    </PageShell>
  )
}
