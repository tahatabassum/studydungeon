import { Heart, Skull, Sparkles } from 'lucide-react'
import { ProgressBar } from './ProgressBar'
import { RoomProgress, type RoomProgressRoom } from './RoomProgress'

export interface HudProps {
  playerHp: number
  maxPlayerHp: number
  monsterHp: number
  maxMonsterHp: number
  monsterName?: string
  xp: number
  streak?: number
  /** Rooms in ascending order; RoomProgress renders only when provided. */
  rooms?: readonly RoomProgressRoom[]
  currentRoomId?: string | null
  clearedRoomIds?: readonly string[]
}

export function Hud({
  playerHp,
  maxPlayerHp,
  monsterHp,
  maxMonsterHp,
  monsterName,
  xp,
  streak,
  rooms,
  currentRoomId,
  clearedRoomIds,
}: HudProps) {
  return (
    <div className="pointer-events-none flex w-full flex-wrap items-start justify-between gap-3 text-ink">
      {rooms && currentRoomId !== undefined && (
        <div className="w-full">
          <RoomProgress
            rooms={rooms}
            currentRoomId={currentRoomId}
            clearedRoomIds={clearedRoomIds ?? []}
          />
        </div>
      )}
      <div className="min-w-48 flex-1 rounded-lg border border-health bg-panel/90 px-3 py-2 shadow-[0_0_12px_var(--color-health)]">
        <div className="mb-1 flex items-center justify-between gap-2 text-sm font-semibold">
          <span className="flex items-center gap-1.5">
            <Heart aria-hidden="true" className="size-4 text-health" />
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
          fillClassName="bg-health"
        />
      </div>

      <div className="min-w-48 flex-1 rounded-lg border border-danger bg-panel/90 px-3 py-2 shadow-[0_0_12px_var(--color-danger)]">
        <div className="mb-1 flex items-center justify-between gap-2 text-sm font-semibold">
          <span className="flex items-center gap-1.5">
            <Skull aria-hidden="true" className="size-4 text-danger" />
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
          fillClassName="bg-danger"
        />
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-gold bg-panel/90 px-3 py-2 text-sm font-semibold shadow-[0_0_12px_var(--color-gold)]">
        <span className="flex items-center gap-1.5">
          <Sparkles aria-hidden="true" className="size-4 text-gold" />
          <span className="text-gold">XP {xp}</span>
        </span>
        {streak !== undefined && <span className="text-ink-muted">Streak {streak}</span>}
      </div>
    </div>
  )
}
