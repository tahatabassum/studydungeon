import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Button } from './Button'

export interface PauseMenuProps {
  onResume(): void
  onRestart(): void
  returnFocusTo?: HTMLElement | null
}

/**
 * Pause menu (Req 13.1, 13.3). Esc is handled by PlayPage (toggle pause/resume),
 * not here. Focus moves to Resume on mount and returns to `returnFocusTo` on unmount.
 */
export function PauseMenu({ onResume, onRestart, returnFocusTo }: PauseMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const returnRef = useRef(returnFocusTo)

  useEffect(() => {
    returnRef.current = returnFocusTo
  }, [returnFocusTo])

  useEffect(() => {
    rootRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => returnRef.current?.focus()
  }, [])

  // Simple trap: Tab / Shift+Tab cycle between the two buttons.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const buttons = rootRef.current?.querySelectorAll<HTMLButtonElement>('button')
    if (!buttons || buttons.length === 0) return
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border-2 border-purple bg-panel p-8 text-center">
        <h2 id="pause-title" className="text-3xl font-bold text-parchment">
          Paused
        </h2>
        <Button onClick={onResume}>Resume</Button>
        <Button variant="secondary" onClick={onRestart}>
          Restart
        </Button>
      </div>
    </div>
  )
}
