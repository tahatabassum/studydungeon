import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Skull, UserPlus } from 'lucide-react'
import { ProgressBar } from '../components/ProgressBar'
import { useReducedMotion } from '../state/useReducedMotion'
import type { ProgressStatus } from '../state/useProgress'
import type { ProgressInfo } from '../types/api'
import { chooseHeroCta, type HeroCta } from './heroCta'
import type { DashboardDungeon } from './useDashboardDungeon'

export interface HeroProps {
  isGuest: boolean
  displayName: string
  progress: ProgressInfo | null
  progressStatus: ProgressStatus
  /** The dungeon the session points at, or null. Needed to derive the Continue target. */
  dungeonId: string | null
  /** Only `status` and `next` are read. */
  dungeon: Pick<DashboardDungeon, 'status' | 'next'>
  dailyHauntSlot?: ReactNode
  onPlayDemo: () => void
  demoPending: boolean
  onCreateAccount: () => void
}

/** Decorative moon, bats and castle silhouette. Purely visual. */
function HeroArt() {
  return (
    <svg className="sd-hero__art-svg" viewBox="0 0 400 200" preserveAspectRatio="xMaxYMid slice" focusable="false" aria-hidden="true" style={{ position: 'absolute', right: 0, top: 0, width: '60%', height: '100%', opacity: 0.55 }}>
      <circle cx="310" cy="58" r="30" fill="var(--color-bone)" opacity="0.5" />
      <circle cx="322" cy="52" r="26" fill="var(--color-panel)" opacity="0.55" />
      <g fill="var(--color-bg)" opacity="0.95">
        <path d="M230 200V120h12v-14h8v14h10V98l10-16 10 16v22h10v-12h8v12h12V200z" />
        <path d="M290 200v-70h10v-16h8v16h10v-10h8v10h10v70z" />
        <path d="M330 200v-96l14-22 14 22v96z" />
        <path d="M240 200v-30h20v30zM360 200v-60h24v60z" />
      </g>
      <g fill="var(--color-bg)">
        <path d="M120 40c8-6 12-4 16 4 4-8 8-10 16-4-4 2-6 6-6 10-4-2-6-2-10 2-4-4-6-4-10-2 0-4-2-8-6-10z" />
        <path d="M190 80c6-4 9-3 12 3 3-6 6-7 12-3-3 1-4 4-4 7-3-1-5-1-8 2-3-3-5-3-8-2 0-3-1-6-4-7z" />
      </g>
    </svg>
  )
}

function RuneDivider() {
  return (
    <div className="sd-rune-divider" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" focusable="false">
        <path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
      </svg>
    </div>
  )
}

function CtaSlot({ cta }: { cta: HeroCta }) {
  switch (cta.kind) {
    case 'loading':
      return (
        <div className="sd-cta sd-hero__cta sd-hero__cta--loading" role="status" aria-busy="true" aria-live="polite" aria-label="Loading your next room" data-testid="hero-cta-loading">
          <span aria-hidden="true">…</span>
        </div>
      )
    case 'continue':
      return (
        <Link to={cta.to} className="sd-cta sd-hero__cta" data-testid="hero-cta">
          {cta.label}
        </Link>
      )
    case 'daily-haunt':
      return (
        <div className="sd-hero__cta" data-testid="hero-cta">
          {cta.slot}
        </div>
      )
    case 'play-demo':
      return (
        <button type="button" className="sd-cta sd-hero__cta" onClick={cta.onClick} disabled={cta.pending} data-testid="hero-cta">
          <Skull aria-hidden="true" size={18} />
          {cta.pending ? 'Waking the dungeon…' : cta.label}
        </button>
      )
    default: {
      const unreachable: never = cta
      return unreachable
    }
  }
}

/** Dashboard hero: who you are, how far you are, and the one thing to do next. */
export function Hero({ isGuest, displayName, progress, progressStatus, dungeonId, dungeon, dailyHauntSlot, onPlayDemo, demoPending, onCreateAccount }: HeroProps) {
  const reduced = useReducedMotion()
  const cta = chooseHeroCta({ isGuest, demoPending, dungeonId, dungeon, dailyHauntSlot, onPlayDemo })
  const total = progress?.total_xp ?? 0
  const hasNext = progress?.xp_to_next !== undefined
  const target = total + (progress?.xp_to_next ?? 0)

  return (
    <section className="sd-hero" data-testid="dashboard-hero" data-reduced={reduced ? 'true' : 'false'} aria-labelledby="dash-hero-title">
      <div className="sd-hero__art" aria-hidden="true" data-testid="hero-decor" data-reduced={reduced ? 'true' : 'false'}>
        <HeroArt />
      </div>
      <p className="sd-hero__eyebrow">{isGuest ? 'Guest crawler' : 'Welcome back'}</p>
      <h2 id="dash-hero-title" className="sd-hero__title">
        {displayName}
      </h2>
      <p className="sd-hero__sub">
        {isGuest ? 'Turn your notes into a haunted dungeon. Try the demo now, or create an account to keep your progress.' : 'The dungeon waits. Pick up where you left off.'}
      </p>

      {progressStatus === 'loading' ? (
        <div className="sd-hero__level" role="status" aria-live="polite" aria-busy="true" aria-label="Loading your level" data-testid="hero-level-loading">
          <span className="sd-hero__badge" aria-hidden="true">
            …
          </span>
        </div>
      ) : (
        progress && (
          <div className="sd-hero__level" data-testid="hero-level">
            <span className="sd-hero__badge" aria-hidden="true">
              {progress.level}
            </span>
            <div className="sd-hero__xp">
              <p className="sd-hero__xp-text" style={{ margin: 0 }}>{`Level ${progress.level}`}</p>
              {hasNext ? (
                <>
                  <ProgressBar value={total} max={target} label="XP toward the next level" tone="gold" />
                  <span className="sd-hero__xp-text">{`${total} / ${target} XP`}</span>
                </>
              ) : (
                <span className="sd-hero__xp-text">{`Total ${total} XP`}</span>
              )}
            </div>
          </div>
        )
      )}

      <div className="sd-hero__actions">
        <CtaSlot cta={cta} />
        {isGuest && (
          <button type="button" className="sd-page__link" onClick={onCreateAccount} data-testid="hero-create-account">
            <UserPlus aria-hidden="true" size={14} />
            Create account
          </button>
        )}
      </div>

      <RuneDivider />
    </section>
  )
}
