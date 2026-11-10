import { Link } from 'react-router-dom'
import { Ghost } from 'lucide-react'
import '../styles/haunt.css'
import { HauntCelebration } from './HauntCelebration'
import { hauntPath } from './modes'
import { useDailyHaunt } from './useDailyHaunt'

export interface DailyHauntButtonProps {
  dungeonId: string | null
  /** Header variant: one row, smaller text. */
  compact?: boolean
}

/**
 * The Daily Haunt entry: the number of memories due and the streak, both from the Backend. With nothing due
 * it celebrates and says when the next memory stirs. Where the backend cannot build a Daily Haunt it says so.
 */
export function DailyHauntButton({ dungeonId, compact = false }: DailyHauntButtonProps) {
  const haunt = useDailyHaunt()
  const cls = `sd-haunt${compact ? ' sd-haunt--compact' : ''}`

  if (haunt.status === 'loading') {
    return (
      <div className={cls} data-testid="daily-haunt" data-state="loading">
        <span className="sd-skel" style={{ height: 22, width: 160 }} aria-hidden="true" />
        <span className="sr-only">Checking your memories</span>
      </div>
    )
  }

  if (haunt.status === 'unsupported') {
    return (
      <div className={cls} data-testid="daily-haunt" data-state="unsupported">
        <button type="button" className="sd-haunt-cta" aria-disabled="true" aria-describedby="haunt-soon">
          <Ghost aria-hidden="true" size={18} />
          Daily Haunt
        </button>
        <p id="haunt-soon" className="sd-haunt__meta">
          Coming soon: daily review runs need support from the backend.
        </p>
      </div>
    )
  }

  if (haunt.status === 'error') {
    return (
      <div className={cls} data-testid="daily-haunt" data-state="error">
        <p role="alert" className="sd-haunt__meta">
          {haunt.message}{' '}
          <button type="button" className="sd-link-btn" onClick={haunt.retry}>
            Retry
          </button>
        </p>
      </div>
    )
  }

  const { summary, nowMs } = haunt
  const due = summary.due_count
  if (due === 0) {
    return (
      <div className={cls} data-testid="daily-haunt" data-state="empty">
        <HauntCelebration nextDueAt={summary.next_due_at} nowMs={nowMs} dailyStreak={summary.daily_streak} />
      </div>
    )
  }
  const inHaunt = summary.items.length
  return (
    <div className={cls} data-testid="daily-haunt" data-state="due">
      <div className="sd-haunt__row">
        {dungeonId ? (
          <Link to={hauntPath(dungeonId)} className="sd-haunt-cta" data-testid="daily-haunt-link">
            <Ghost aria-hidden="true" size={18} />
            Daily Haunt
          </Link>
        ) : (
          <button type="button" className="sd-haunt-cta" aria-disabled="true">
            <Ghost aria-hidden="true" size={18} />
            Daily Haunt
          </button>
        )}
        <span className="sd-haunt__meta" data-testid="daily-haunt-due">
          {`${due} ${due === 1 ? 'memory' : 'memories'} due`}
        </span>
        {summary.daily_streak > 0 && (
          <span className="sd-haunt__streak" data-testid="daily-haunt-streak">
            {`${summary.daily_streak}-day streak`}
          </span>
        )}
      </div>
      {inHaunt > 0 && inHaunt < due && <p className="sd-haunt__meta">{`Today's haunt faces ${inHaunt} of them.`}</p>}
    </div>
  )
}
