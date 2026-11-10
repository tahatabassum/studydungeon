import type { ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import PlayPage from '../pages/PlayPage'
import { Spinner } from '../components/Spinner'
import '../styles/haunt.css'
import { HauntCelebration } from './HauntCelebration'
import { useDailyHaunt } from './useDailyHaunt'

function Notice({ dungeonId, children }: { dungeonId: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-4 text-ink" data-testid="haunt-notice">
      {children}
      <div className="flex gap-4">
        <Link to="/dashboard" className="sd-ghost-btn">
          Dashboard
        </Link>
        <Link to={`/campaign/${encodeURIComponent(dungeonId)}`} className="sd-ghost-btn">
          Open the map
        </Link>
      </div>
    </main>
  )
}

/**
 * `/haunt/:dungeonId`: the Daily Haunt. It checks the Backend first: no support shows a "coming soon"
 * note, nothing due shows the celebration with the next due time, and otherwise the Haunted Hall opens.
 */
export default function HauntPage() {
  const { dungeonId } = useParams()
  const haunt = useDailyHaunt()
  if (!dungeonId) return <Navigate to="/dashboard" replace />

  if (haunt.status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center gap-3 bg-bg text-ink">
        <Spinner label="Checking your memories..." />
        <span aria-hidden="true">Checking your memories...</span>
      </main>
    )
  }
  if (haunt.status === 'unsupported') {
    return (
      <Notice dungeonId={dungeonId}>
        <p role="status">The Daily Haunt is coming soon. This backend cannot build review runs yet.</p>
      </Notice>
    )
  }
  if (haunt.status === 'error') {
    return (
      <Notice dungeonId={dungeonId}>
        <p role="alert">{haunt.message}</p>
        <button type="button" className="sd-cta" onClick={haunt.retry}>
          Try again
        </button>
      </Notice>
    )
  }
  if (haunt.summary.due_count === 0) {
    return (
      <Notice dungeonId={dungeonId}>
        <HauntCelebration nextDueAt={haunt.summary.next_due_at} nowMs={haunt.nowMs} dailyStreak={haunt.summary.daily_streak} />
      </Notice>
    )
  }
  return <PlayPage key={`haunt:${dungeonId}`} scope={{ dungeonId, floorId: null, mode: 'daily_haunt' }} />
}
