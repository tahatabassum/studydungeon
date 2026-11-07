import { Heart, Skull, Sparkles } from 'lucide-react'
import { ProgressBar } from './ProgressBar'

export interface HudProps {
  playerHp: number
  maxPlayerHp: number
  monsterHp: number
  maxMonsterHp: number
  monsterName?: string
  xp: number
  streak?: number
}

export function Hud({
  playerHp,
  maxPlayerHp,
  monsterHp,
  maxMonsterHp,
  monsterName,
  xp,
  streak,
}: HudProps) {
  return (
    <div className="pointer-events-none flex w-full flex-wrap items-start justify-between gap-3 text-parchment">
      <div className="min-w-48 flex-1 rounded-lg border border-mint bg-panel/90 px-3 py-2 shadow-[0_0_12px_var(--color-mint)]">
        <div className="mb-1 flex items-center justify-between gap-2 text-sm font-semibold">
          <span className="flex items-center gap-1.5">
            <Heart aria-hidden="true" className="size-4 text-mint" />
            Player
          </span>
          <span>
            {playerHp} / {maxPlayerHp}
          </span>
        </div>
        <ProgressBar
          value={playerHp}
          max={maxPlayerHp}
          label="Player health"
          fillClassName="bg-mint"
        />
      </div>

      <div className="min-w-48 flex-1 rounded-lg border border-blood bg-panel/90 px-3 py-2 shadow-[0_0_12px_var(--color-blood)]">
        <div className="mb-1 flex items-center justify-between gap-2 text-sm font-semibold">
          <span className="flex items-center gap-1.5">
            <Skull aria-hidden="true" className="size-4 text-blood" />
            {monsterName ?? 'Monster'}
          </span>
          <span>
            {monsterHp} / {maxMonsterHp}
          </span>
        </div>
        <ProgressBar
          value={monsterHp}
          max={maxMonsterHp}
          label="Monster health"
          fillClassName="bg-blood"
        />
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-amber bg-panel/90 px-3 py-2 text-sm font-semibold shadow-[0_0_12px_var(--color-amber)]">
        <span className="flex items-center gap-1.5">
          <Sparkles aria-hidden="true" className="size-4 text-amber" />
          <span className="text-amber">XP {xp}</span>
        </span>
        {streak !== undefined && <span className="text-muted">Streak {streak}</span>}
      </div>
    </div>
  )
}
