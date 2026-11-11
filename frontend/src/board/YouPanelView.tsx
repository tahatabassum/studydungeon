import { Link } from 'react-router-dom'
import { UpgradeOffer } from '../identity/UpgradeOffer'
import type { BoardMe } from '../types/api'
import { youPanelView } from './youPanel'

export interface YouPanelProps {
  me: BoardMe | null
  isGuest: boolean
}

/** The live "You" panel below the table. Its numbers come from the Backend as sent and can be ahead of the table. */
export function YouPanel({ me, isGuest }: YouPanelProps) {
  const v = youPanelView(me, { isGuest, canUpgrade: true })
  if (!v) {
    return (
      <section className="sd-card sd-lb__you" aria-label="You" data-testid="you-panel">
        <p className="sd-card__text">You are not on the board yet.</p>
        <Link to="/play-as-guest" className="sd-cta">
          Pick a name and play to join
        </Link>
      </section>
    )
  }
  return (
    <section className="sd-card sd-lb__you" aria-label="You" data-testid="you-panel">
      <p className="sd-lb__you-live">Live, can be ahead of the table</p>
      {v.kind === 'first_points' ? (
        <p className="sd-card__text">Earn your first points to join the board</p>
      ) : (
        <p className="sd-card__text">
          <strong>Rank {v.rank}</strong>
          {`, ${v.points.toLocaleString('en-US')} Leaderboard points`}
        </p>
      )}
      {v.kind === 'ranked' && v.rank === 1 && !v.passLine && <p className="sd-card__muted">You lead</p>}
      {v.passLine && (
        <p className="sd-card__muted">{`${v.passLine.pointsNeeded.toLocaleString('en-US')} points to pass ${v.passLine.handle}`}</p>
      )}
      {v.enterLine && (
        <p className="sd-card__muted">{`${v.enterLine.pointsNeeded.toLocaleString('en-US')} points to enter the top 20`}</p>
      )}
      {v.cta === 'upgrade' && <UpgradeOffer isGuest look="secondary" />}
    </section>
  )
}
