import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Trophy, AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import { Spinner } from './Spinner'
import type { RunSummary } from '@/types/api'

export interface VictoryOverlayProps {
  summary: RunSummary | null
  pending?: boolean
  error?: string | null
  onRetry?(): void
  onPlayAgain(): void
  onExit(): void
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
}: VictoryOverlayProps) {
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    rootRef.current?.querySelector<HTMLButtonElement>('button[data-play-again]')?.focus()
  }, [])

  const showError = !summary && !pending && !!error

  const stats: Array<[string, string]> = summary
    ? [
        ['Score', String(summary.score)],
        ['XP', String(summary.xp)],
        ['Correct', `${summary.correct} / ${summary.total}`],
        ['Accuracy', formatPercent(summary.accuracy)],
      ]
    : []

  return (
    <motion.div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 p-4"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4 }}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border-2 border-accent bg-panel p-8 text-center shadow-[0_0_48px_var(--color-accent)]">
        <Trophy
          aria-hidden="true"
          className="h-12 w-12 text-accent motion-safe:animate-bounce"
        />
        <h2 id="victory-title" className="font-[family-name:var(--font-display)] text-3xl font-bold text-ink">
          The Exam Warden falls!
        </h2>
        <p className="text-ink-muted">Dungeon cleared</p>

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
              <div key={label} className="rounded-lg border border-magic bg-bg/40 p-3">
                <dt className="text-sm text-ink-muted">{label}</dt>
                <dd className="text-xl font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <Button data-play-again onClick={onPlayAgain}>
            Play again
          </Button>
          <Button variant="secondary" onClick={onExit}>
            Exit
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
