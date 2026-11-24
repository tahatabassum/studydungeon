import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { Avatar, avatarKind } from '../leaderboard/Avatar'
import { useBoard } from '../board/useBoard'
import type { BoardEntry } from '../types/api'
import { CardSkeleton } from './ProgressCards'

function nameOf(e: BoardEntry): string {
  return e.display_name ?? e.handle
}

/**
 * Top 5 of the real leaderboard (overall, all time), straight from GET /leaderboard, with the player's live
 * rank below when they are not in it. Points and ranks are shown exactly as the server sends them.
 */
export function LiveTopFiveCard() {
  const { status, data, error, refresh } = useBoard('overall', 'all')
  if (status === 'loading') return <CardSkeleton label="the leaderboard" rows={5} />
  if (status === 'error' || !data) {
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
          <button type="button" className="sd-ghost-btn" onClick={refresh}>
            Retry
          </button>
        </div>
      </section>
    )
  }
  const top = data.entries.slice(0, 5)
  const me = data.me
  const meInTop = me?.public_id !== undefined && top.some((e) => e.public_id === me.public_id)
  return (
    <section className="sd-card" aria-labelledby="dash-board-title" data-testid="board-preview">
      <h2 id="dash-board-title" className="sd-card__h">
        <Trophy aria-hidden="true" size={18} />
        Top 5
      </h2>
      {top.length === 0 ? (
        <p className="sd-card__muted">No one is on the board yet. Clear a room to be the first.</p>
      ) : (
        <ol className="sd-dash__board">
          {top.map((e) => {
            const isMe = me?.public_id !== undefined && e.public_id === me.public_id
            return (
              <li key={e.public_id} data-me={isMe ? 'true' : undefined} aria-current={isMe ? 'true' : undefined}>
                <span className="sd-dash__board-rank">{e.rank}</span>
                <Avatar kind={avatarKind({ id: e.public_id }, isMe)} size={28} />
                <span className="sd-dash__board-name" title={nameOf(e)}>
                  {nameOf(e)}
                  {isMe && <span className="sd-lb__tag">You</span>}
                </span>
                <span className="sd-dash__board-score">{e.points.toLocaleString('en-US')}</span>
              </li>
            )
          })}
          {me && me.rank !== null && !meInTop && (
            <li data-me="true" aria-current="true" className="sd-dash__board-me">
              <span className="sd-dash__board-rank">{me.rank}</span>
              <Avatar kind="player" size={28} />
              <span className="sd-dash__board-name">
                {me.handle ?? 'You'}
                <span className="sd-lb__tag">You</span>
              </span>
              <span className="sd-dash__board-score">{me.points.toLocaleString('en-US')}</span>
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