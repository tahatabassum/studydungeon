import { AlertTriangle } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import { useCountUp } from './useCountUp'
import { VictoryFx } from './VictoryFx'
import { Button } from './Button'
import { OverlayFrame } from './OverlayFrame'
import { PixelSprite } from './PixelSprite'
import { Spinner } from './Spinner'
import { CHARACTER_SPRITES, ICONS } from '@/art/sprites'
import type { RunSummary } from '@/types/api'

export interface VictoryOverlayProps {
  summary: RunSummary | null
  pending?: boolean
  error?: string | null
  onRetry?(): void
  onPlayAgain(): void
  onExit(): void
  /** Campaign floors: "<Boss> falls!" instead of the Exam Warden line. */
  title?: string
  /** Campaign floors: "Floor 1 cleared" instead of "Dungeon cleared". */
  subtitle?: string
  playAgainLabel?: string
  exitLabel?: string
}

/** Formatting only: the backend values are shown as received (Req 8.4). */
const formatPercent = (accuracy: number) => `${Math.round(accuracy * 100)}%`

/** Victory overlay (Req 8.3, 8.7, 8.8, 8.9). Play again receives focus on mount. */
export function VictoryOverlay({
  summary,
  pending = false,
  error = null,
  onRetry,
  onPlayAgain,
  onExit,
  title = 'The Exam Warden falls!',
  subtitle = 'Dungeon cleared',
  playAgainLabel = 'Play again',
  exitLabel = 'Exit',
}: VictoryOverlayProps) {
  const showError = !summary && !pending && !!error
  const reduced = !!useReducedMotion()
  const xpShown = useCountUp(summary?.xp ?? 0, reduced)

  const stats: Array<[string, string]> = summary
    ? [
        ['Score', String(summary.score)],
        ['XP', String(summary.xp)],
        ['Correct', `${summary.correct} / ${summary.total}`],
        ['Accuracy', formatPercent(summary.accuracy)],
      ]
    : []

  return (
    <OverlayFrame
      title={title}
      titleId="victory-title"
      initialFocus="button[data-play-again]"
      backdrop={<VictoryFx />}
      character={
        <>
          <PixelSprite map={CHARACTER_SPRITES.skeleton_companion} scale={3} />
          <PixelSprite map={ICONS.crown} scale={5} className={reduced ? '' : 'motion-safe:animate-bounce'} />
          <PixelSprite map={CHARACTER_SPRITES.friendly_ghost} scale={3} />
        </>
      }
    >
      <p className="font-(family-name:--font-label) text-ink-muted">{subtitle}</p>

      {pending && !summary && (
        <div className="flex items-center gap-2 text-ink-muted">
          <Spinner label="Loading results" />
          <span>Tallying your results…</span>
        </div>
      )}

      {showError && (
        <div role="alert" className="flex flex-col items-center gap-3 text-ink">
          <AlertTriangle aria-hidden="true" className="h-6 w-6 text-danger" />
          <p>{error}</p>
          {onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      )}

      {summary && (
        <dl className="grid w-full grid-cols-2 gap-3 text-ink">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-deep bg-panel p-3">
              <dt className="font-(family-name:--font-label) text-sm text-ink-muted">{label}</dt>
              <dd className="text-xl font-bold text-gold">
                {label === 'XP' ? (
                  <>
                    <span aria-hidden="true" data-testid="xp-counter">
                      {xpShown}
                    </span>
                    <span className="sr-only">{value}</span>
                  </>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap justify-center gap-3 font-(family-name:--font-label)">
        <Button data-play-again onClick={onPlayAgain}>
          {playAgainLabel}
        </Button>
        <Button variant="secondary" onClick={onExit}>
          {exitLabel}
        </Button>
      </div>
    </OverlayFrame>
  )
}
