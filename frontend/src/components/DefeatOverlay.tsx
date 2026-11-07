import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Skull } from 'lucide-react'
import { Button } from './Button'

export interface DefeatOverlayProps {
  onRetry(): void
  xp?: number
  score?: number
}

/** Defeat overlay (Req 12.4). Retry receives focus on mount (Req 12.6). */
export function DefeatOverlay({ onRetry, xp, score }: DefeatOverlayProps) {
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    rootRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [])

  return (
    <motion.div
      ref={rootRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="defeat-title"
      aria-describedby="defeat-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4 }}
    >
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border-2 border-blood bg-panel p-8 text-center shadow-[0_0_48px_var(--color-blood)]">
        <Skull aria-hidden="true" className="h-12 w-12 text-blood" />
        <h2 id="defeat-title" className="text-3xl font-bold text-parchment">
          You have fallen
        </h2>
        <p id="defeat-desc" className="text-parchment">
          The monster won this round. Review your notes and try again.
          {xp !== undefined && <span className="block text-muted">XP earned: {xp}</span>}
          {score !== undefined && <span className="block text-muted">Score: {score}</span>}
        </p>
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </motion.div>
  )
}
