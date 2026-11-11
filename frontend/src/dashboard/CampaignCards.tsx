import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Map as MapIcon, Play, Settings, Skull, UserPlus, Layers } from 'lucide-react'
import { playPath } from '../campaign/CampaignPage'
import { PathChoice } from '../identity/PathChoice'
import { UpgradeOffer } from '../identity/UpgradeOffer'
import { MasteryBar } from '../learning/MasteryBar'
import { MASTERY_BAND_LABEL, masteryBand } from '../learning/mastery'
import type { FinishedRun } from '../leaderboard/sessionRuns'
import type { DashboardDungeon } from './useDashboardDungeon'
import { CardSkeleton } from './ProgressCards'

const pct = (ratio: number): string => `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`

export interface ContinueCardProps {
  dungeonId: string | null
  dungeon: DashboardDungeon
  onPlayDemo(): void
  demoPending: boolean
  demoError: string | null
  /** Filled by frontend-08 Phase 3 with the Daily Haunt button. Rendered under the actions when given. */
  dailyHauntSlot?: ReactNode
}

/** Continue (next playable floor of the map), Play Demo, and the Daily Haunt slot. */
export function ContinueCard({ dungeonId, dungeon, onPlayDemo, demoPending, demoError, dailyHauntSlot }: ContinueCardProps) {
  const { next } = dungeon
  const mapPath = dungeonId ? `/campaign/${encodeURIComponent(dungeonId)}` : null
  const target = next && dungeonId ? playPath(dungeonId, next.type === 'floor' ? next.floor.id : next.boss.id) : mapPath
  const label =
    next?.type === 'floor'
      ? `Floor ${next.floor.index}, ${next.floor.title}`
      : next?.type === 'final'
        ? next.boss.name
        : dungeon.status === 'ready'
          ? 'Every floor is cleared or still locked'
          : ''
  return (
    <section className="sd-card sd-dash__continue" aria-labelledby="dash-continue-title" data-testid="continue-card">
      <h2 id="dash-continue-title" className="sd-card__h">
        <Skull aria-hidden="true" size={18} />
        Dungeon
      </h2>
      {dungeonId && dungeon.status === 'loading' && <span className="sd-skel" style={{ height: 22, width: '70%' }} aria-hidden="true" />}
      {dungeonId && dungeon.status === 'error' && (
        <p role="alert" className="sd-card__muted">
          {dungeon.error} <button type="button" className="sd-link-btn" onClick={dungeon.retry}>Retry</button>
        </p>
      )}
      {dungeonId && dungeon.status === 'ready' && dungeon.name && <p className="sd-dash__big">{dungeon.name}</p>}
      {label && <p className="sd-card__muted" data-testid="continue-hint">{`Next: ${label}`}</p>}
      <div className="sd-dash__actions">
        {target && (
          <Link to={target} className="sd-cta" data-testid="continue-link">
            <Play aria-hidden="true" size={18} />
            Continue dungeon
          </Link>
        )}
        {mapPath && (
          <Link to={mapPath} className="sd-ghost-btn">
            <MapIcon aria-hidden="true" size={16} />
            Open the map
          </Link>
        )}
        <button type="button" className="sd-ghost-btn" onClick={onPlayDemo} disabled={demoPending} aria-busy={demoPending || undefined}>
          Play Demo
        </button>
      </div>
      <PathChoice variant="compact" />
      {demoError && (
        <p role="alert" className="sd-card__muted">
          {demoError}
        </p>
      )}
      {dailyHauntSlot && (
        <div data-testid="daily-haunt-slot" className="sd-dash__slot">
          {dailyHauntSlot}
        </div>
      )}
    </section>
  )
}

/** Mastery rings per topic, grouped by floor. Real mode shows its single legacy floor. */
export function MasteryCard({ dungeon }: { dungeon: DashboardDungeon }) {
  if (dungeon.status === 'loading') return <CardSkeleton label="mastery" />
  if (dungeon.status === 'error') {
    return (
      <section className="sd-card sd-card--alert" data-testid="mastery-error">
        <h2 className="sd-card__h">
          <AlertTriangle aria-hidden="true" size={18} />
          Mastery
        </h2>
        <p role="alert" className="sd-card__muted">
          {dungeon.error}
        </p>
        <div>
          <button type="button" className="sd-ghost-btn" onClick={dungeon.retry}>
            Retry
          </button>
        </div>
      </section>
    )
  }
  const floors = dungeon.floors.filter((f) => f.topics.length > 0)
  return (
    <section className="sd-card sd-dash__wide" aria-labelledby="dash-mastery-title" data-testid="mastery-card">
      <h2 id="dash-mastery-title" className="sd-card__h">
        <Layers aria-hidden="true" size={18} />
        Mastery by topic
      </h2>
      {floors.length === 0 ? (
        <p className="sd-card__muted">Topic mastery appears here once you have played a floor.</p>
      ) : (
        <div className="sd-dash__floors">
          {floors.map((f) => (
            <div key={f.id} className="sd-dash__floor" data-floor={f.id}>
              <h3 className="sd-dash__floor-h">{dungeon.campaign ? `Floor ${f.index}, ${f.title}` : f.title}</h3>
              <ul className="sd-dash__topics" aria-label={`Topics of ${f.title}`}>
                {f.topics.map((t) => {
                  const band = masteryBand(t.mastery)
                  return (
                    <li key={t.id} data-band={band}>
                      <MasteryBar value={t.mastery} size={46} stroke={5} />
                      <span className="sd-dash__topic">{t.title}</span>
                      <span className="sd-score__band" data-band={band}>{`${MASTERY_BAND_LABEL[band]} ${Math.round(t.mastery)}%`}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Settings opens /settings. Upload notes sits in the Dungeon card at the top. */
export function LinksCard() {
  return (
    <section className="sd-card sd-dash__links" aria-labelledby="dash-links-title" data-testid="links-card">
      <h2 id="dash-links-title" className="sd-card__h">
        More
      </h2>
      <div className="sd-dash__actions">
        <Link to="/settings" className="sd-ghost-btn" data-testid="settings-link">
          <Settings aria-hidden="true" size={16} />
          Settings
        </Link>
      </div>
    </section>
  )
}

/** Guest: the demo dungeon card with the Play Demo button. */
export function DemoCard({
  onPlayDemo,
  pending,
  error,
  dailyHauntSlot,
}: {
  onPlayDemo(): void
  pending: boolean
  error: string | null
  /** The Daily Haunt button and practice modes, when the app provides them. */
  dailyHauntSlot?: ReactNode
}) {
  return (
    <section className="sd-card sd-dash__continue" aria-labelledby="dash-demo-title" data-testid="demo-card">
      <h2 id="dash-demo-title" className="sd-card__h">
        <Skull aria-hidden="true" size={18} />
        Demo dungeon
      </h2>
      <p className="sd-dash__big">Computer Basics Crypt</p>
      <p className="sd-card__muted">Two floors and a final boss, built from sample notes. No account needed.</p>
      <div className="sd-dash__actions">
        <button type="button" className="sd-cta" onClick={onPlayDemo} disabled={pending} aria-busy={pending || undefined}>
          <Play aria-hidden="true" size={18} />
          Play Demo
        </button>
      </div>
      <PathChoice variant="compact" />
      {error && (
        <p role="alert" className="sd-card__muted">
          {error}
        </p>
      )}
      {dailyHauntSlot && (
        <div data-testid="daily-haunt-slot" className="sd-dash__slot">
          {dailyHauntSlot}
        </div>
      )}
    </section>
  )
}

export interface GuestStatsProps {
  runs: readonly FinishedRun[]
  best: FinishedRun | null
  /** Provisional rank on the demo board, when known. */
  rank: number | null
  onCreateAccount(): void
  /** Opens `/register?upgrade=1`. Pass it only when a Guest session exists; without it the plain register button shows. */
  onUpgrade?(): void
}

/** Guest: stats from this visit only, and the Create account call to action. */
export function GuestStatsCard({ runs, best, rank, onCreateAccount, onUpgrade }: GuestStatsProps) {
  const plainCta = (
    <button type="button" className="sd-cta" onClick={onCreateAccount}>
      <UserPlus aria-hidden="true" size={18} />
      Create account
    </button>
  )
  return (
    <section className="sd-card" aria-labelledby="dash-guest-title" data-testid="guest-stats">
      <h2 id="dash-guest-title" className="sd-card__h">
        <UserPlus aria-hidden="true" size={18} />
        Your visit
      </h2>
      {runs.length === 0 ? (
        <p className="sd-card__muted">No runs yet. Play the demo to see your stats and a provisional rank.</p>
      ) : (
        <dl className="sd-dash__stats">
          <div>
            <dt>Runs</dt>
            <dd>{runs.length}</dd>
          </div>
          <div>
            <dt>Best score</dt>
            <dd>{(best?.score ?? 0).toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>Best accuracy</dt>
            <dd>{pct(Math.max(...runs.map((r) => r.accuracy)))}</dd>
          </div>
          <div>
            <dt>Provisional rank</dt>
            <dd>{rank !== null ? `#${rank}` : 'None yet'}</dd>
          </div>
        </dl>
      )}
      <p className="sd-card__text">These stats live only in this tab. Create an account to save progress and claim your spot.</p>
      <div>
        {onUpgrade ? (
          <UpgradeOffer
            isGuest
            look="cta"
            onActivate={onUpgrade}
            icon={<UserPlus aria-hidden="true" size={18} />}
            fallback={plainCta}
          />
        ) : (
          plainCta
        )}
      </div>
    </section>
  )
}
