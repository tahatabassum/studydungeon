import { Maximize, Minimize } from 'lucide-react'

export interface FullscreenButtonProps {
  isFullscreen: boolean
  onToggle: () => void
}

/** Icon button for fullscreen; the F key does the same. */
export function FullscreenButton({ isFullscreen, onToggle }: FullscreenButtonProps) {
  const Icon = isFullscreen ? Minimize : Maximize
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isFullscreen}
      aria-label={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
      className="sd-control pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-lg border-2 border-magic bg-[var(--sd-hud-surface)] text-ink hover:enabled:border-accent"
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  )
}
