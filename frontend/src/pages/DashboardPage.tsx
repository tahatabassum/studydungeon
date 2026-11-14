import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Trophy } from 'lucide-react'
import { useLogout } from '../state/useLogout'
import { WakingUp } from './WakingUp'
import '../styles/dashboard.css'
import { PageShell } from '../components/PageShell'
import { HauntedBackdrop } from '../components/HauntedBackdrop'
import '../styles/haunted.css'
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
import { displayHandle } from '../identity/handle'
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
  const { user, dungeonId: sessionDungeonId } = useSession()
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
            display_name: user ? displayHandle(user) : 'You',
            level: progress?.level ?? 1,
            score: best.score,
            accuracy: best.accuracy,
            best_streak: best.bestStreak,
            is_guest: isGuest,
          }
        : null,
    [best, user, progress?.level, isGuest],
  )
  const view = useMemo(() => (board.data ? buildBoardView(board.data, { limit: 5, run: myRun }) : null), [board.data, myRun])
  const myRank = view?.meRow?.rank ?? null

  const preview = (
    <LeaderboardPreviewCard support={support} status={board.status} error={board.error} view={view} onRetry={board.refresh} />
  )
  const toRegister = () => navigate('/register')
  const toUpgrade = () => navigate('/register?upgrade=1')

  const { loggingOut, logOut } = useLogout()

  return (
    <PageShell
      wide
      testId="dashboard-page"
      className="sd-dark"
      decor={<HauntedBackdrop />}
      title="Dashboard"
      subtitle={isGuest ? (user ? `Playing as ${displayHandle(user)}` : 'Playing as a guest') : `Welcome back, ${displayHandle(user)}`}
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
      {demo.pending && (
        <WakingUp
          offerOffline={demo.offerOffline}
          onOffline={() => void demo.chooseOffline()}
          onKeepWaiting={demo.keepWaiting}
          keptWaiting={demo.keptWaiting}
          timedOut={demo.timedOut}
          onRetry={() => void demo.retry()}
        />
      )}
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

          <div className="sd-dash__stack">
            {progressState.status === 'loading' ? (
              <CardSkeleton label="recent runs" />
            ) : (
              progress && <RecentRunsCard runs={progress.recent_runs ?? []} />
            )}
            {progress && <HauntCard count={progress.due_review_count ?? 0} />}
          </div>
          {progress && <ProgressPanel progress={progress} />}

          {dungeonId && <MasteryCard dungeon={dungeon} />}

          {progress && <BadgesCard earned={progress.badges} className="sd-dash__wide" />}
          {progress && <ArmoryCard weapons={progress.weapons} level={progress.level} />}
          <LinksCard />
        </div>
      ) : (
        <div className="sd-dash" data-view="guest">
          <DemoCard onPlayDemo={() => void demo.start()} pending={demo.pending} error={demo.error} dailyHauntSlot={dailyHauntSlot} />
          <GuestStatsCard runs={runs} best={best} rank={myRank} onCreateAccount={toRegister} onUpgrade={user ? toUpgrade : undefined} />
          {preview}
          {progress && <ProgressPanel progress={progress} />}
          <section className="sd-card" aria-labelledby="dash-guest-runs">
            <h2 id="dash-guest-runs" className="sd-card__h">
              Recent runs
            </h2>
            {runs.length === 0 ? <p className="sd-card__muted">Runs you finish in this tab show up here.</p> : <SessionRunsList runs={runs} />}
          </section>
          {dungeonId && <MasteryCard dungeon={dungeon} />}
          <BadgesCard earned={[]} className="sd-dash__wide" />
        </div>
      )}
    </PageShell>
  )
}
