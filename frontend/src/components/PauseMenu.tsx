import { Footprints, Volume2, VolumeX } from 'lucide-react'
import { Button } from './Button'
import { OverlayFrame } from './OverlayFrame'
import { PixelSprite } from './PixelSprite'
import { CHARACTER_SPRITES } from '@/art/sprites'

export interface PauseMenuProps {
  onResume(): void
  onRestart(): void
  returnFocusTo?: HTMLElement | null
  /** Current muted state; shown on the toggle (Req 10.2). */
  muted?: boolean
  /** When provided, a Mute toggle is rendered. */
  onToggleMute?(): void
  /** When provided, an Exit button is rendered. */
  onExit?(): void
  /** When provided, a "Retreat from battle" button is rendered (paused mid-question). */
  onRetreat?(): void
}

/**
 * Pause menu (Req 10.2). Esc is handled by PlayPage (toggle pause/resume),
 * not here. Focus moves to Resume on mount and returns to `returnFocusTo` on unmount.
 */
export function PauseMenu({
  onResume,
  onRestart,
  returnFocusTo,
  muted = false,
  onToggleMute,
  onExit,
  onRetreat,
}: PauseMenuProps) {
  return (
    <OverlayFrame
      title="Paused"
      titleId="pause-title"
      returnFocusTo={returnFocusTo}
      widthClass="max-w-sm"
      character={<PixelSprite map={CHARACTER_SPRITES.friendly_ghost} scale={3} />}
    >
      <div className="flex w-full flex-col items-stretch gap-3 font-(family-name:--font-label)">
        <Button onClick={onResume}>Resume</Button>
        {onRetreat && (
          <Button variant="secondary" onClick={onRetreat}>
            <Footprints aria-hidden="true" className="h-5 w-5" />
            Retreat from battle
          </Button>
        )}
        {onToggleMute && (
          <Button variant="secondary" aria-pressed={muted} onClick={onToggleMute}>
            {muted ? (
              <VolumeX aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Volume2 aria-hidden="true" className="h-5 w-5" />
            )}
            {muted ? 'Sound on' : 'Mute'}
          </Button>
        )}
        <Button variant="secondary" onClick={onRestart}>
          Restart
        </Button>
        {onExit && (
          <Button variant="secondary" onClick={onExit}>
            Exit
          </Button>
        )}
      </div>
    </OverlayFrame>
  )
}
