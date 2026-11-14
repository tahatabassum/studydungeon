import { Button } from './Button'
import { DefeatCandles } from './DefeatCandles'
import { OverlayFrame } from './OverlayFrame'
import { PixelSprite } from './PixelSprite'
import { CHARACTER_SPRITES, ICONS } from '@/art/sprites'

export interface DefeatOverlayProps {
  onRetry(): void
  xp?: number
  score?: number
}

/** Defeat overlay (Req 12.4). Retry receives focus on mount (Req 12.6). */
export function DefeatOverlay({ onRetry, xp, score }: DefeatOverlayProps) {
  return (
    <OverlayFrame
      title="You have fallen"
      titleId="defeat-title"
      role="alertdialog"
      describedBy="defeat-desc"
      character={
        <>
          <PixelSprite map={CHARACTER_SPRITES.bat} scale={3} />
          <PixelSprite map={ICONS.skull} scale={5} />
          <PixelSprite map={CHARACTER_SPRITES.black_cat} scale={3} />
        </>
      }
    >
      <p id="defeat-desc" className="text-ink">
        The monster won this round. Review your notes and try again.
        {xp !== undefined && <span className="block text-ink-muted">XP earned: {xp}</span>}
        {score !== undefined && <span className="block text-ink-muted">Dungeon score: {score}</span>}
      </p>
      <DefeatCandles />
      <div className="font-(family-name:--font-label)">
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </OverlayFrame>
  )
}
