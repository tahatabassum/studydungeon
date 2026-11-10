import { Pause } from 'lucide-react'

export interface PauseButtonProps {
  onPause: () => void
}

/** HUD Pause button for touch play. It does the same as Esc. */
export function PauseButton({ onPause }: PauseButtonProps) {
  return (
    <button
      type="button"
      onClick={onPause}
      aria-label="Pause game"
      data-testid="pause-button"
      className="sd-control pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-magic bg-[var(--sd-hud-surface)] text-ink hover:enabled:border-accent"
    >
      <Pause aria-hidden="true" className="size-5" />
    </button>
  )
}
