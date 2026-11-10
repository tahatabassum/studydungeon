import type { ReactNode } from 'react'
import { AlertTriangle, History, Shield, Swords, Ghost } from 'lucide-react'
import { BadgeGrid } from '../badges/BadgeGrid'
import { HauntedCounter } from '../components/HauntedCounter'
import { ProgressBar } from '../components/ProgressBar'
import type { FinishedRun } from '../leaderboard/sessionRuns'
import { Armory } from '../weapons/Armory'
import type { ProgressInfo } from '../types/api'

const pct = (ratio: number): string => `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`

export function CardSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <section className="sd-card" role="status" aria-live="polite" aria-label={`Loading ${label}`} data-testid="card-skeleton">
      <span className="sd-skel" style={{ height: 14, width: '40%' }} aria-hidden="true" />
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="sd-skel" style={{ height: 22, width: i === rows - 1 ? '70%' : '100%' }} aria-hidden="true" />
      ))}
      <span className="sr-only">{`Loading ${label}`}</span>
    </section>
  )
}

export function ProgressErrorCard({ error, onRetry }: { error: string | null; onRetry(): void }) {
  return (
    <section className="sd-card sd-card--alert sd-dash__wide" data-testid="progress-error">
      <h2 className="sd-card__h">
        <AlertTriangle aria-hidden="true" size={18} />
        Progress unavailable
      </h2>
      <p role="alert" className="sd-card__text">
        {error ?? 'Your progress could not be loaded.'}
      </p>
      <div>
        <button type="button" className="sd-ghost-btn" onClick={onRetry}>
          Retry
        </button>
      </div>
    </section>
  )
}

/** Level, XP bar and totals. The backend owns level and XP to next. */
export function LevelCard({ progress }: { progress: ProgressInfo }) {
  const total = progress.total_xp
  const hasNext = progress.xp_to_next !== undefined
  const target = total + (progress.xp_to_next ?? 0)
  return (
    <section className="sd-card sd-dash__level" aria-labelledby="dash-level-title" data-testid="level-card">
      <h2 id="dash-level-title" className="sd-card__h">
        <Shield aria-hidden="true" size={18} />
        Your level
      </h2>
      <div className="sd-dash__level-row">
        <span className="sd-dash__seal" aria-hidden="true">
          {progress.level}
        </span>
        <div className="sd-dash__level-info">
          <p className="sd-dash__big">{`Level ${progress.level}`}</p>
          {hasNext ? (
            <>
              <ProgressBar value={total} max={target} label="XP toward the next level" tone="gold" />
              <p className="sd-card__muted">{`${total} / ${target} XP, ${progress.xp_to_next} to the next level`}</p>
            </>
          ) : (
            <p className="sd-card__muted">{`Total ${total} XP`}</p>
          )}
        </div>
      </div>
    </section>
  )
}

export function RecentRunsCard({ runs }: { runs: NonNullable<ProgressInfo['recent_runs']> }) {
  return (
    <section className="sd-card" aria-labelledby="dash-runs-title" data-testid="recent-runs">
      <h2 id="dash-runs-title" className="sd-card__h">
        <History aria-hidden="true" size={18} />
        Recent runs
      </h2>
      {runs.length === 0 ? (
        <p className="sd-card__muted">No runs yet. Finish a floor and it shows up here.</p>
      ) : (
        <ul className="sd-dash__list">
          {runs.slice(0, 5).map((r) => (
            <li key={r.id}>
              <span className="sd-dash__li-main">{r.dungeon_name}</span>
              <span className="sd-dash__li-score">{r.score.toLocaleString('en-US')}</span>
              <span className="sd-dash__li-meta">{`${pct(r.accuracy)} accuracy`}</span>
              <span className="sd-dash__li-meta">{new Date(r.finished_at).toLocaleDateString('en-US')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Haunted memories due, plus the slot frontend-08 Phase 3 fills with the Daily Haunt button. */
export function HauntCard({ count, dailyHauntSlot }: { count: number; dailyHauntSlot?: ReactNode }) {
  return (
    <section className="sd-card" aria-labelledby="dash-haunt-title" data-testid="haunt-card">
      <h2 id="dash-haunt-title" className="sd-card__h">
        <Ghost aria-hidden="true" size={18} />
        Haunted memories
      </h2>
      <HauntedCounter count={count} />
      <p className="sd-card__muted">Questions you missed come back as ghosts. Lay them to rest to keep them in mind.</p>
      {dailyHauntSlot && (
        <div data-testid="daily-haunt-slot" className="sd-dash__slot">
          {dailyHauntSlot}
        </div>
      )}
    </section>
  )
}

export function BadgesCard({ earned, className = '' }: { earned: readonly string[] | undefined; className?: string }) {
  const count = earned?.length ?? 0
  return (
    <section className={`sd-card ${className}`.trim()} aria-labelledby="dash-badges-title" data-testid="badges-card">
      <h2 id="dash-badges-title" className="sd-card__h">
        <Swords aria-hidden="true" size={18} />
        {`Badges (${count})`}
      </h2>
      <BadgeGrid earned={earned} />
    </section>
  )
}

export function ArmoryCard({ weapons, level }: { weapons: ProgressInfo['weapons']; level: number }) {
  if (!weapons || weapons.length === 0) return null
  return (
    <section className="sd-card" data-testid="armory-card">
      <Armory weapons={weapons} level={level} equippable />
    </section>
  )
}

/** Recent runs of this visit, for a guest (nothing is stored on the server). */
export function SessionRunsList({ runs }: { runs: readonly FinishedRun[] }) {
  return (
    <ul className="sd-dash__list">
      {runs.slice(0, 5).map((r, i) => (
        <li key={`${r.finishedAt}-${i}`}>
          <span className="sd-dash__li-main">Demo run</span>
          <span className="sd-dash__li-score">{r.score.toLocaleString('en-US')}</span>
          <span className="sd-dash__li-meta">{`${pct(r.accuracy)} accuracy`}</span>
        </li>
      ))}
    </ul>
  )
}
