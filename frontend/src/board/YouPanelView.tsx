import { Link } from 'react-router-dom'
import { UpgradeOffer } from '../identity/UpgradeOffer'
import { plural } from '../upload/quotaView'
import type { BoardMe } from '../types/api'
import { formatCountdown } from './countdown'
import { youPanelView } from './youPanel'

export interface YouPanelProps {
  me: BoardMe | null
  isGuest: boolean
  /** When the table was last built (ISO) and when it refreshes next (ms). Shown as small print when given. */
  updatedAt?: string
  nextRefreshMs?: number | null
  nowMs?: number
}

function Refresh({ updatedAt, nextRefreshMs, nowMs }: Pick<YouPanelProps, 'updatedAt' | 'nextRefreshMs' | 'nowMs'>) {
  if (updatedAt === undefined) return null
  const updated = new Date(updatedAt)
  const time = Number.isNaN(updated.getTime()) ? '' : updated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return (
    <p className="sd-lb__you-refresh" data-testid="lb-refresh">
      {time ? `Table updated at ${time}, refreshes hourly.` : 'The table refreshes hourly.'}
      {nextRefreshMs != null && nowMs !== undefined && <span data-testid="lb-countdown">{` Next refresh in ${formatCountdown(nextRefreshMs, nowMs)}.`}</span>}
    </p>
  )
}

/** The live "Your live rank" panel beside the table. Its numbers come from the Backend as sent and can be ahead of the table. */
export function YouPanel({ me, isGuest, updatedAt, nextRefreshMs, nowMs }: YouPanelProps) {
  const v = youPanelView(me, { isGuest, canUpgrade: true })
  const head = (
    <>
      <h2 className="sd-lb__you-title">Your live rank</h2>
      <p className="sd-lb__you-live">Updates instantly. The table refreshes hourly.</p>
    </>
  )
  if (!v) {
    return (
      <section className="sd-card sd-lb__you" aria-label="You" data-testid="you-panel">
        {head}
        <p className="sd-card__text">You are not on the board yet.</p>
        <Link to="/play-as-guest" className="sd-cta">
          Pick a name and play to join
        </Link>
        <Refresh updatedAt={updatedAt} nextRefreshMs={nextRefreshMs} nowMs={nowMs} />
      </section>
    )
  }
  return (
    <section className="sd-card sd-lb__you" aria-label="You" data-testid="you-panel">
      {head}
      {v.kind === 'first_points' ? (
        <p className="sd-card__text">Earn your first points to join the board</p>
      ) : (
        <p className="sd-card__text">
          <strong>Rank {v.rank}</strong>
          {`, ${plural(v.points, 'Leaderboard point', 'Leaderboard points')}`}
        </p>
      )}
      {v.kind === 'ranked' && v.rank === 1 && !v.passLine && <p className="sd-card__muted">You lead</p>}
      {v.passLine && (
        <p className="sd-card__muted">{`${plural(v.passLine.pointsNeeded, 'point', 'points')} to pass ${v.passLine.handle}`}</p>
      )}
      {v.enterLine && (
        <p className="sd-card__muted">{`${plural(v.enterLine.pointsNeeded, 'point', 'points')} to enter the top 20`}</p>
      )}
      <Refresh updatedAt={updatedAt} nextRefreshMs={nextRefreshMs} nowMs={nowMs} />
      {v.cta === 'upgrade' && <UpgradeOffer isGuest look="secondary" />}
    </section>
  )
}