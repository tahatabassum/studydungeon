import { Check, Crown, Lock, MapPin } from 'lucide-react'

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

type MarkerState = 'cleared' | 'current' | 'locked'

const STATE_TEXT: Record<MarkerState, string> = {
  cleared: 'cleared',
  current: 'current',
  locked: 'locked',
}

export function RoomProgress({ rooms, currentRoomId, clearedRoomIds }: RoomProgressProps) {
  const currentIndex = rooms.findIndex((r) => r.id === currentRoomId)
  const current = currentIndex >= 0 ? rooms[currentIndex] : undefined

  return (
    <div className="rounded-lg border border-deep bg-panel/90 px-3 py-2 text-sm text-ink">
      <p className="mb-1 font-semibold">
        {current ? `Room ${currentIndex + 1} of ${rooms.length}: ${current.label}` : `${rooms.length} rooms`}
      </p>
      <ol aria-label="Dungeon progress" className="flex items-center gap-2">
        {rooms.map((room) => {
          const state: MarkerState = clearedRoomIds.includes(room.id)
            ? 'cleared'
            : room.id === currentRoomId
              ? 'current'
              : 'locked'
          const Icon = room.is_boss
            ? Crown
            : state === 'cleared'
              ? Check
              : state === 'current'
                ? MapPin
                : Lock
          const style =
            state === 'cleared'
              ? 'border-health text-health'
              : state === 'current'
                ? 'border-accent text-accent border-2'
                : 'border-ink-muted text-ink-muted border-dashed'
          return (
            <li
              key={room.id}
              data-state={state}
              data-boss={room.is_boss ? 'true' : undefined}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`flex size-7 items-center justify-center border ${
                room.is_boss ? 'rounded-md' : 'rounded-full'
              } ${style}`}
            >
              <Icon aria-hidden="true" className="size-4" />
              <span className="sr-only">
                {`${room.label}: ${room.is_boss ? 'boss, ' : ''}${STATE_TEXT[state]}`}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
