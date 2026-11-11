import { useState, type CSSProperties, type ReactNode } from 'react'
import { AlertTriangle, ArrowUp, Gift, Share2, Trophy, UserPlus } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import '../styles/scorecard.css'
import { BadgeGrid } from '../badges/BadgeGrid'
import { Button } from '../components/Button'
import { OverlayFrame } from '../components/OverlayFrame'
import { SourceLine } from '../components/SourceLine'
import { UpgradeOffer } from '../identity/UpgradeOffer'
import { ShareDialog } from '../share/ShareDialog'
import { Spinner } from '../components/Spinner'
import { VictoryFx } from '../components/VictoryFx'
import { MasteryBar } from '../learning/MasteryBar'
import { WEAPON_ICONS } from '../weapons/weaponIcons'
import { resolveWeapon } from '../weapons/weapons'
import type { ChestReward, FloorRank, ProgressInfo, RunSummary } from '../types/api'
import { MASTERY_BAND_LABEL, classifyMastery, topicRows } from './mastery'
import { useCountUp } from './useCountUp'

export interface ScorecardProps {
  /** Pack flow: shown on a final boss clear when packs are on. Opens the unlock or completion screen, else the map. */
  onContinue?: () => void
  summary: RunSummary | null
  pending?: boolean
  error?: string | null
  /** Run values already received (score and XP from the run), kept on screen when finishRun fails (Req 10.10). */
  received?: { score: number; xp: number } | null
  onRetry?(): void
  onPlayAgain(): void
  onExit(): void
  /** Campaign floors: "<Boss> falls!" instead of the Exam Warden line. */
  title?: string
  /** Campaign floors: "Floor 1 cleared" instead of "Dungeon cleared". */
  subtitle?: string
  playAgainLabel?: string
  exitLabel?: string
  /** Level, total XP and XP to next, for the XP bar. */
  progress?: ProgressInfo | null
  isGuest?: boolean
  /** False hides the rank reveal and the leaderboard button (the backend has no leaderboard). */
  leaderboardEnabled?: boolean
  onViewLeaderboard?(): void
  onCreateAccount?(): void
  /** Opens the upgrade flow (`/register?upgrade=1`). Defaults to `onCreateAccount`. */
  onUpgrade?(): void
  /** Slot for the frontend-08 Chest (Phase 5 of that spec), shown under the chest rewards. */
  chestSlot?: ReactNode
  /** Name shown on the share card. */
  dungeonName?: string
}

const cssVars = (vars: Record<string, string>): CSSProperties => vars as CSSProperties

/** Formatting only: the backend values are shown as received. */
const percent = (ratio: number): number => Math.round(Math.min(1, Math.max(0, ratio)) * 100)

/** Text for the polite live region: the final results, announced once when the summary arrives. */
export function scorecardAnnouncement(summary: RunSummary, leaderboardEnabled = true): string {
  const parts = [`Run complete. Dungeon score ${summary.score}.`, `Accuracy ${percent(summary.accuracy)} percent.`, `${summary.xp} XP earned.`]
  if (summary.floor_rank) parts.push(`Floor rank ${summary.floor_rank}.`)
  if (summary.level_up) parts.push(`Level up, level ${summary.level_up.from} to ${summary.level_up.to}.`)
  if (summary.weapon_unlocked) parts.push(`Weapon unlocked: ${resolveWeapon(summary.weapon_unlocked).name}.`)
  if (leaderboardEnabled && summary.leaderboard_rank !== undefined) parts.push(`Leaderboard rank ${summary.leaderboard_rank}.`)
  return parts.join(' ')
}

const RANK_NAME: Record<FloorRank, string> = { S: 'Sovereign', A: 'Adept', B: 'Apprentice', C: 'Novice' }

function AccuracyRing({ ratio }: { ratio: number }) {
  const size = 116
  const stroke = 11
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = percent(ratio)
  return (
    <div className="sd-score__ring" data-testid="accuracy-ring">
      <svg
        role="img"
        aria-label={`Accuracy ${p} percent`}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-deep)" strokeWidth={stroke} />
        <circle
          className="sd-score__ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-health)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * p) / 100} ${c}`}
          style={cssVars({ '--ring-len': `${c}` })}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="sd-score__ring-text" aria-hidden="true">
        {p}%
      </span>
    </div>
  )
}

function RankSeal({ rank }: { rank: FloorRank }) {
  return (
    <div className="sd-score__seal" data-rank={rank} data-testid="floor-rank">
      <span className="sd-score__seal-letter" aria-hidden="true">
        {rank}
      </span>
      <span className="sd-score__seal-name">
        <span className="sr-only">Floor rank {rank}, </span>
        {RANK_NAME[rank]}
      </span>
    </div>
  )
}

function XpBlock({ summary, progress, reduced }: { summary: RunSummary; progress: ProgressInfo | null; reduced: boolean }) {
  const xpShown = useCountUp(summary.xp, { reduced, delayMs: 250 })
  const hasBar = progress?.xp_to_next !== undefined
  const total = progress?.total_xp ?? 0
  const next = hasBar ? total + (progress?.xp_to_next ?? 0) : 0
  const fraction = hasBar && next > 0 ? Math.min(1, Math.max(0, total / next)) : 0
  const levelUp = summary.level_up
  return (
    <section aria-labelledby="score-xp-title" className="sd-score__block">
      <h3 id="score-xp-title" className="sd-score__h">
        Experience
      </h3>
      <p className="sd-score__xp">
        +
        <span aria-hidden="true" data-testid="xp-counter">
          {xpShown}
        </span>
        <span className="sr-only">{summary.xp}</span> XP
      </p>
      {hasBar && (
        <>
          <div
            role="progressbar"
            aria-label="XP toward the next level"
            aria-valuemin={0}
            aria-valuemax={next}
            aria-valuenow={total}
            className="sd-score__bar"
            data-levelup={levelUp ? 'true' : undefined}
          >
            <div className="sd-score__bar-fill" style={cssVars({ '--fill': String(fraction) })} />
          </div>
          <p className="sd-score__meta">
            {progress?.level !== undefined ? `Level ${progress.level}. ` : ''}
            {total} / {next} XP
          </p>
        </>
      )}
      {!hasBar && progress && <p className="sd-score__meta">{`Total ${total} XP`}</p>}
      {levelUp && (
        <p className="sd-levelup" data-testid="level-up">
          <span aria-hidden="true" className="sd-levelup__sparks">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} style={cssVars({ '--a': `${i * 45}deg` })} />
            ))}
          </span>
          <ArrowUp aria-hidden="true" size={18} />
          <span>{`Level up! Level ${levelUp.from} to ${levelUp.to}`}</span>
        </p>
      )}
    </section>
  )
}

function RankReveal({ rank, guest, reduced }: { rank: number; guest: boolean; reduced: boolean }) {
  // The number slides down from further back in the field to the final rank.
  const from = Math.max(rank + 12, 20)
  const moved = useCountUp(from - rank, { reduced, durationMs: 1100, delayMs: 700 })
  return (
    <section aria-labelledby="score-rank-title" className="sd-score__block sd-score__reveal" data-testid="rank-reveal">
      <h3 id="score-rank-title" className="sd-score__h">
        Leaderboard
      </h3>
      <p className="sd-score__rank">
        <Trophy aria-hidden="true" size={22} />
        <span aria-hidden="true" data-testid="rank-counter">{`#${from - moved}`}</span>
        <span className="sr-only">{`Rank ${rank}`}</span>
      </p>
      <p className="sd-score__meta">{guest ? 'Provisional rank on the demo board' : 'Your rank on the demo board'}</p>
    </section>
  )
}

function ChestList({ rewards }: { rewards: readonly ChestReward[] }) {
  return (
    <ul className="sd-score__list" aria-label="Chest rewards">
      {rewards.map((c) => (
        <li key={c.id} data-kind={c.kind}>
          <Gift aria-hidden="true" size={16} />
          <span className="flex-1">{c.label}</span>
          {c.amount !== undefined && <span className="tabular-nums text-gold">{`+${c.amount}`}</span>}
        </li>
      ))}
    </ul>
  )
}

/**
 * The end-of-run Scorecard (Req 10). It replaces the VictoryOverlay content after a floor, the final boss or a
 * full run: score count-up, accuracy ring, XP bar with a level-up effect, unlocks, topic mastery, weak concepts
 * with the Source_Line, an animated rank reveal and the follow-up buttons.
 */
export function Scorecard({
  summary,
  pending = false,
  error = null,
  received = null,
  onRetry,
  onPlayAgain,
  onExit,
  onContinue,
  title = 'The Exam Warden falls!',
  subtitle = 'Dungeon cleared',
  playAgainLabel = 'Play again',
  exitLabel = 'Exit',
  progress = null,
  isGuest = false,
  leaderboardEnabled = true,
  onViewLeaderboard,
  onCreateAccount,
  onUpgrade,
  chestSlot,
  dungeonName = 'StudyDungeon',
}: ScorecardProps) {
  const reduced = !!useReducedMotion()
  const [shareOpen, setShareOpen] = useState(false)
  const showError = !summary && !pending && !!error
  const scoreShown = useCountUp(summary?.score ?? 0, { reduced, active: summary !== null })

  const topics = summary ? topicRows(summary) : []
  const weak = summary?.weak_concepts ?? []
  const badges = summary?.badges_earned ?? []
  const weaponId = summary?.weapon_unlocked ?? null
  const WeaponIcon = weaponId ? WEAPON_ICONS[weaponId] : null
  const chest = summary?.chest_rewards ?? []
  const rank = summary?.leaderboard_rank

  return (
    <OverlayFrame
      title={title}
      titleId="victory-title"
      initialFocus="button[data-play-again]"
      backdrop={<VictoryFx />}
      widthClass="max-w-4xl"
    >
      <p className="font-(family-name:--font-label) text-ink-muted">{subtitle}</p>

      {pending && !summary && (
        <div className="flex items-center gap-2 text-ink-muted">
          <Spinner label="Loading results" />
          <span>Tallying your results…</span>
        </div>
      )}

      {showError && (
        <div role="alert" className="sd-score__error">
          <AlertTriangle aria-hidden="true" className="h-6 w-6 text-danger" />
          <p>{error}</p>
          {received && (
            <p className="sd-score__meta" data-testid="received-values">
              {`Dungeon score so far ${received.score}, XP earned ${received.xp}.`}
            </p>
          )}
          {onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      )}

      {summary && (
        <div className="sd-score" data-testid="scorecard">
          <div role="status" aria-live="polite" className="sr-only" data-testid="scorecard-live">
            {scorecardAnnouncement(summary, leaderboardEnabled)}
          </div>

          <section className="sd-score__hero" aria-label="Results">
            <div className="sd-score__total">
              <span className="sd-score__label">Dungeon score</span>
              <span className="sd-score__num" aria-hidden="true" data-testid="score-counter">
                {scoreShown}
              </span>
              <span className="sr-only">{`Dungeon score ${summary.score}`}</span>
              <span className="sd-score__meta">{`${summary.correct} / ${summary.total} correct`}</span>
            </div>
            <AccuracyRing ratio={summary.accuracy} />
            {summary.floor_rank && <RankSeal rank={summary.floor_rank} />}
          </section>

          {summary.points_earned !== undefined && (
            <section className="sd-score__block" aria-label="Leaderboard points" data-testid="leaderboard-points">
              <p className="sd-score__meta">
                <strong>Leaderboard points</strong>{' '}
                <span data-testid="leaderboard-points-value">{summary.points_earned}</span>
              </p>
              <p className="sd-score__meta">Leaderboard points are what the ranking counts. Dungeon score is just for this run.</p>
            </section>
          )}
          <div className="sd-score__cols">
            <div className="sd-score__col">
              <XpBlock summary={summary} progress={progress} reduced={reduced} />

              {(WeaponIcon || badges.length > 0 || summary.badges_earned !== undefined) && (
                <section aria-labelledby="score-unlock-title" className="sd-score__block">
                  <h3 id="score-unlock-title" className="sd-score__h">
                    Unlocked
                  </h3>
                  {weaponId && WeaponIcon && (
                    <p className="sd-score__weapon" data-testid="weapon-unlocked">
                      <WeaponIcon aria-hidden="true" size={22} />
                      <span>
                        <span className="sr-only">Weapon unlocked: </span>
                        {resolveWeapon(weaponId).name}
                      </span>
                    </p>
                  )}
                  {badges.length > 0 ? (
                    <BadgeGrid earned={badges} showLocked={false} flourish={!reduced} />
                  ) : (
                    <p className="sd-score__meta">No new badges this run.</p>
                  )}
                </section>
              )}

              {leaderboardEnabled && rank !== undefined && <RankReveal rank={rank} guest={isGuest} reduced={reduced} />}
            </div>

            <div className="sd-score__col">
              <section aria-labelledby="score-mastery-title" className="sd-score__block">
                <h3 id="score-mastery-title" className="sd-score__h">
                  Topic mastery
                </h3>
                {topics.length === 0 ? (
                  <p className="sd-score__meta">No topic data for this run.</p>
                ) : (
                  <ul className="sd-score__topics" aria-label="Topic mastery">
                    {topics.map((t) => {
                      const band = classifyMastery(t.percent)
                      return (
                        <li key={t.id} data-band={band}>
                          <MasteryBar value={t.percent} size={44} stroke={5} />
                          <span className="sd-score__topic-name">{t.title}</span>
                          <span className="sd-score__band" data-band={band}>
                            {`${MASTERY_BAND_LABEL[band]} ${Math.round(t.percent)}%`}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              <section aria-labelledby="score-weak-title" className="sd-score__block sd-score__parchment">
                <h3 id="score-weak-title" className="sd-score__h sd-score__h--dark">
                  Weak concepts
                </h3>
                {weak.length === 0 ? (
                  <p className="text-sm">No weak concepts. Nicely done.</p>
                ) : (
                  <ul className="sd-score__weak">
                    {weak.map((w, i) => (
                      <li key={`${w.page}-${i}`}>
                        <p className="font-semibold">{w.text}</p>
                        <SourceLine source={{ page: w.page, chunk_id: '' }} className="mt-1 px-2 py-1" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {(chest.length > 0 || chestSlot) && (
                <section aria-labelledby="score-chest-title" className="sd-score__block">
                  <h3 id="score-chest-title" className="sd-score__h">
                    Chest rewards
                  </h3>
                  {chest.length > 0 && <ChestList rewards={chest} />}
                  {chestSlot}
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="sd-score__actions font-(family-name:--font-label)">
        <Button data-play-again onClick={onPlayAgain}>
          {playAgainLabel}
        </Button>
        <Button variant="secondary" onClick={onExit}>
          {exitLabel}
        </Button>
        {summary && onContinue && (
          <Button variant="secondary" onClick={onContinue} data-testid="scorecard-continue">
            Continue
          </Button>
        )}
        {leaderboardEnabled && onViewLeaderboard && (
          <Button variant="secondary" onClick={onViewLeaderboard}>
            <Trophy aria-hidden="true" size={16} />
            View leaderboard
          </Button>
        )}
        {summary && (
          <Button variant="secondary" className="sd-score__share" onClick={() => setShareOpen(true)}>
            <Share2 aria-hidden="true" size={16} />
            Share card
          </Button>
        )}
        {summary && isGuest && onCreateAccount && (
          <UpgradeOffer
            isGuest
            onActivate={onUpgrade ?? onCreateAccount}
            icon={<UserPlus aria-hidden="true" size={16} />}
            fallback={
              <Button variant="secondary" onClick={onCreateAccount}>
                <UserPlus aria-hidden="true" size={16} />
                Create account
              </Button>
            }
          />
        )}
      </div>
      {shareOpen && summary && (
        <ShareDialog
          data={{
            score: summary.score,
            rank: leaderboardEnabled ? summary.leaderboard_rank : null,
            badges: badges,
            dungeonName,
            floorRank: summary.floor_rank ?? null,
          }}
          onClose={() => setShareOpen(false)}
        />
      )}
    </OverlayFrame>
  )
}
