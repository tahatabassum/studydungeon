import { Link } from 'react-router-dom'
import { Hourglass, Trophy } from 'lucide-react'
import { Avatar, avatarKind } from '../leaderboard/Avatar'
import type { BoardView } from '../leaderboard/view'
import type { LeaderboardStatus } from '../leaderboard/useLeaderboard'
import type { LeaderboardSupport } from '../state/useLeaderboardSupport'
import { CardSkeleton } from './ProgressCards'

export interface LeaderboardPreviewProps {
  support: LeaderboardSupport
  status: LeaderboardStatus
  error: string | null
  view: BoardView | null
  onRetry(): void
}

/** Top-5 preview with the player's row highlighted (and shown below when outside the top 5). */
export function LeaderboardPreviewCard({ support, status, error, view, onRetry }: LeaderboardPreviewProps) {
  if (support === 'no') {
    return (
      <section className="sd-card" data-testid="board-preview">
        <h2 className="sd-card__h">
          <Hourglass aria-hidden="true" size={18} />
          Leaderboard
        </h2>
        <p className="sd-card__muted">The leaderboard is coming soon.</p>
      </section>
    )
  }
  if (support === 'unknown' || status === 'loading') return <CardSkeleton label="the leaderboard" rows={5} />
  if (status === 'error') {
    return (
      <section className="sd-card sd-card--alert" data-testid="board-preview">
        <h2 className="sd-card__h">
          <Trophy aria-hidden="true" size={18} />
          Leaderboard
        </h2>
        <p role="alert" className="sd-card__muted">
          {error}
        </p>
        <div>
          <button type="button" className="sd-ghost-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      </section>
    )
  }
  const rows = view ? [...view.podium, ...view.rows].slice(0, 5) : []
  const me = view?.meRow ?? null
  const meInList = me !== null && rows.some((r) => r.entry.id === me.entry.id)
  return (
    <section className="sd-card" aria-labelledby="dash-board-title" data-testid="board-preview">
      <h2 id="dash-board-title" className="sd-card__h">
        <Trophy aria-hidden="true" size={18} />
        Top 5
      </h2>
      {rows.length === 0 ? (
        <p className="sd-card__muted">No one is on the board yet.</p>
      ) : (
        <ol className="sd-dash__board">
          {rows.map((r) => (
            <li key={r.entry.id} data-me={r.isMe ? 'true' : undefined} aria-current={r.isMe ? 'true' : undefined}>
              <span className="sd-dash__board-rank">{r.rank}</span>
              <Avatar kind={avatarKind(r.entry, r.isMe)} size={28} />
              <span className="sd-dash__board-name">
                {r.entry.display_name}
                {r.isMe && <span className="sd-lb__tag">You</span>}
              </span>
              <span className="sd-dash__board-score">{r.entry.score.toLocaleString('en-US')}</span>
            </li>
          ))}
          {me && !meInList && (
            <li data-me="true" aria-current="true" className="sd-dash__board-me">
              <span className="sd-dash__board-rank">{me.rank}</span>
              <Avatar kind="player" size={28} />
              <span className="sd-dash__board-name">
                {me.entry.display_name}
                <span className="sd-lb__tag">You</span>
                {me.provisional && <span className="sd-lb__tag sd-lb__tag--soft">Provisional</span>}
              </span>
              <span className="sd-dash__board-score">{me.entry.score.toLocaleString('en-US')}</span>
            </li>
          )}
        </ol>
      )}
      <div>
        <Link to="/leaderboard" className="sd-ghost-btn">
          Full leaderboard
        </Link>
      </div>
    </section>
  )
}
