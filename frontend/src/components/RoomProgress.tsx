import { motion, useReducedMotion } from 'framer-motion'
import { check, crown, lock } from '../art/sprites/icons'
import { PixelSprite } from './PixelSprite'
import { roomMarkerState, type RoomMarker } from './hudHelpers'

export interface RoomProgressRoom {
  id: string
  label: string
  is_boss: boolean
}

export interface RoomProgressProps {
  /** Rooms in ascending `order`. */
  rooms: readonly RoomProgressRoom[]
  currentRoomId: string | null
  clearedRoomIds: readonly string[]
}

const STATE_TEXT: Record<RoomMarker, string> = {
  cleared: 'cleared',
  current: 'current room',
  locked: 'locked',
}

const STATE_STYLE: Record<RoomMarker, string> = {
  cleared: 'border-health text-health bg-surface-2 opacity-80',
  current:
    'border-2 border-magic text-accent bg-deep shadow-[0_0_8px_2px_var(--color-magic)] motion-safe:animate-pulse',
  locked: 'border-dashed border-ink-muted text-ink-muted bg-bg opacity-70',
}

export function RoomProgress({ rooms, currentRoomId, clearedRoomIds }: RoomProgressProps) {
  const reduce = useReducedMotion()
  const currentIndex = rooms.findIndex((r) => r.id === currentRoomId)
  const current = currentIndex >= 0 ? rooms[currentIndex] : undefined

  return (
    <div className="flex h-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg border border-deep bg-panel/90 px-2 py-1 text-sm text-ink">
      <p className="font-semibold">
        {current ? `Room ${currentIndex + 1} of ${rooms.length}: ${current.label}` : `${rooms.length} rooms`}
      </p>
      <ol aria-label="Dungeon progress" className="m-0 flex list-none items-center gap-1.5 p-0">
        {rooms.map((room) => {
          const { state, isBoss } = roomMarkerState(room, currentRoomId, clearedRoomIds)
          const map = isBoss ? crown : state === 'cleared' ? check : state === 'locked' ? lock : null
          return (
            <motion.li
              key={room.id}
              data-state={state}
              data-boss={isBoss ? 'true' : undefined}
              aria-current={state === 'current' ? 'step' : undefined}
              initial={false}
              animate={reduce ? undefined : { scale: state === 'current' ? 1.1 : 1 }}
              transition={reduce ? { duration: 0 } : { duration: 0.25 }}
              className={`flex size-6 items-center justify-center border transition-colors motion-reduce:transition-none ${
                isBoss ? 'rounded-md' : 'rounded-full'
              } ${STATE_STYLE[state]}`}
            >
              {map ? (
                <PixelSprite map={map} width={14} height={14} />
              ) : (
                <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
              )}
              <span className="sr-only">
                {`${room.label}: ${STATE_TEXT[state]}${isBoss ? ', boss' : ''}`}
              </span>
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}
