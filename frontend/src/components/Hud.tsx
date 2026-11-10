import { useState } from 'react'
import { AlertTriangle, Flame } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { getSprite } from '../art/sprites'
import { ICONS } from '../art/sprites/icons'
import { PixelSprite } from './PixelSprite'
import { HauntedCounter } from './HauntedCounter'
import { ComboMeter } from './ComboMeter'
import { comboValue } from '../learning/combo'
import { isLowHealth } from './hudHelpers'
import { ProgressBar } from './ProgressBar'
import { StoneFrame } from './StoneFrame'
import '../styles/hud.css'
import { RoomProgress, type RoomProgressRoom } from './RoomProgress'

export interface HudProps {
  playerHp: number
  maxPlayerHp: number
  monsterHp: number
  maxMonsterHp: number
  monsterName?: string
  xp: number
  streak?: number
  /** Optional level display (wired by a later task); rendered only when provided. */
  level?: number
  xpToNext?: number
  totalXp?: number
  /** Rooms in ascending order; RoomProgress renders only when provided. */
  rooms?: readonly RoomProgressRoom[]
  currentRoomId?: string | null
  clearedRoomIds?: readonly string[]
  /** Monster sprite kind (e.g. paper_wraith); unknown kinds fall back to a skull. */
  monsterKind?: string
  /** Boss encounter: uses the exam_warden portrait with a crown badge. */
  isBoss?: boolean
  /** Render the monster block (default true). */
  showMonster?: boolean
  /** Compact top bar (viewport below 640 px): hero, monster chip and XP only. */
  compact?: boolean
  /** Haunted memories due; the counter renders only when provided. */
  hauntedDue?: number
  /** What the rooms are called in the progress line (default "Room"; the Haunted Hall says "Hall"). */
  roomNoun?: string
  /** Backend combo; the Combo_Meter shows `combo ?? streak`. */
  combo?: number
}

export function Hud({
  playerHp,
  maxPlayerHp,
  monsterHp,
  maxMonsterHp,
  monsterName,
  xp,
  streak,
  level,
  xpToNext,
  totalXp,
  rooms,
  currentRoomId,
  clearedRoomIds,
  monsterKind,
  isBoss = false,
  showMonster = true,
  compact = false,
  hauntedDue,
  roomNoun,
  combo,
}: HudProps) {
  const reduceMotion = useReducedMotion()
  const lowHealth = isLowHealth(playerHp, maxPlayerHp)
  return (
    <div
      data-hud-mode={compact ? 'compact' : 'full'}
      className={`pointer-events-none flex w-full flex-wrap items-stretch text-ink ${compact ? 'gap-1' : 'gap-2'}`}
    >
      {!compact && rooms && currentRoomId !== undefined && (
        <div className="shrink-0">
          <RoomProgress
            rooms={rooms}
            currentRoomId={currentRoomId}
            clearedRoomIds={clearedRoomIds ?? []}
            noun={roomNoun}
          />
        </div>
      )}
      <StoneFrame
        tone={lowHealth ? 'danger' : 'default'}
        className={`${compact ? 'min-w-32' : 'min-w-44'} flex-1 px-2 py-1 ${lowHealth && !reduceMotion ? 'sd-lowhp' : ''}`}
        data-low-health={lowHealth ? 'true' : undefined}
      >
        <div className="mb-0.5 flex items-center justify-between gap-2 text-sm font-semibold">
          <span className="flex items-center gap-1.5 font-label tracking-wide">
            <PixelSprite map={ICONS.heart} scale={1} />
            Hero
          </span>
          <span className="tabular-nums">
            {playerHp} / {maxPlayerHp}
          </span>
        </div>
        <span aria-hidden="true" className="sd-bone-divider mb-0.5" style={{ height: '0.3rem' }} />
        <ProgressBar
          value={playerHp}
          max={maxPlayerHp}
          label="Player health"
          tone={lowHealth ? 'danger' : 'health'}
        />
        {lowHealth && (
          <p role="status" className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[color-mix(in_srgb,var(--color-danger),var(--color-ink)_45%)]">
            <AlertTriangle aria-hidden="true" className="size-3.5" />
            Low health
          </p>
        )}
      </StoneFrame>
      {showMonster && (
        <MonsterBlock
          monsterHp={monsterHp}
          maxMonsterHp={maxMonsterHp}
          monsterName={monsterName}
          monsterKind={monsterKind}
          isBoss={isBoss}
          reduceMotion={!!reduceMotion}
          compact={compact}
        />
      )}

      <motion.div
        key={xp}
        initial={reduceMotion ? false : { scale: 1.12 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.35 }}
        className="sd-stone flex flex-wrap items-center gap-x-3 gap-y-0 px-2 py-1 text-sm font-semibold"
      >
        <span className="flex items-center gap-1.5">
          <PixelSprite map={ICONS.star} scale={1} />
          <span className="text-gold">{`XP ${xp}`}</span>
        </span>
        {level !== undefined && <span className="font-label text-[color-mix(in_srgb,var(--color-magic),var(--color-ink)_40%)]">{`Lv ${level}`}</span>}
        {!compact && level !== undefined && totalXp !== undefined && xpToNext !== undefined && (
          <span className="text-xs text-ink/80">{`Total ${totalXp} XP · ${xpToNext} to next`}</span>
        )}
        {/* Real mode sends no xp_to_next: show the total only. */}
        {!compact && level !== undefined && totalXp !== undefined && xpToNext === undefined && (
          <span className="text-xs text-ink/80">{`Total ${totalXp} XP`}</span>
        )}
        {streak !== undefined && streak > 0 && (
          <span className="flex items-center gap-1 text-accent">
            <Flame aria-hidden="true" className="size-4" />
            {`Streak ${streak}`}
          </span>
        )}
      </motion.div>
      <ComboMeter value={comboValue(combo, streak ?? 0)} />
      {hauntedDue !== undefined && <HauntedCounter count={hauntedDue} compact={compact} />}
    </div>
  )
}

interface MonsterBlockProps {
  monsterHp: number
  maxMonsterHp: number
  monsterName?: string
  monsterKind?: string
  isBoss: boolean
  reduceMotion: boolean
  compact: boolean
}

function MonsterBlock({
  monsterHp,
  maxMonsterHp,
  monsterName,
  monsterKind,
  isBoss,
  reduceMotion,
  compact,
}: MonsterBlockProps) {
  // Derived during render: counts HP decreases so the hit flash can re-trigger.
  const [prevHp, setPrevHp] = useState(monsterHp)
  const [hitCount, setHitCount] = useState(0)
  if (prevHp !== monsterHp) {
    setPrevHp(monsterHp)
    if (monsterHp < prevHp) setHitCount(hitCount + 1)
  }

  const kind = isBoss ? 'exam_warden' : monsterKind
  const portrait = (kind ? getSprite(kind) : undefined) ?? ICONS.skull

  return (
    <StoneFrame tone="danger" className={`${compact ? 'min-w-32' : 'min-w-52'} flex-1 overflow-hidden px-2 py-1`}>
      {hitCount > 0 && !reduceMotion && (
        <motion.div
          key={hitCount}
          aria-hidden="true"
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none absolute inset-0 bg-danger"
        />
      )}
      <div className="flex items-center gap-2">
        {!compact && (
          <div className="relative shrink-0 rounded-sm border border-deep bg-bg p-0.5">
            <PixelSprite map={portrait} scale={1.5} />
            {isBoss && (
              <span className="absolute -right-2 -top-2 rounded-sm bg-panel p-0.5">
                <PixelSprite map={ICONS.crown} scale={1} />
              </span>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center justify-between gap-2 text-sm font-semibold">
            <span className="flex min-w-0 items-center gap-1.5 font-display text-sm tracking-wide">
              <span className="truncate">{monsterName ?? 'Monster'}</span>
              {isBoss && (
                <span className="flex items-center gap-1 rounded-sm border border-gold/70 px-1 font-label text-xs text-gold">
                  <PixelSprite map={ICONS.skull} scale={1} />
                  Boss
                </span>
              )}
            </span>
            <span className="tabular-nums">
              {monsterHp} / {maxMonsterHp}
            </span>
          </div>
          <ProgressBar
            value={monsterHp}
            max={maxMonsterHp}
            label="Monster health"
            tone="danger"
          />
        </div>
      </div>
    </StoneFrame>
  )
}
