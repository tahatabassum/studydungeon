/**
 * Display-only HUD helpers. These drive presentation (low-health styling,
 * room progress markers) and contain no combat logic.
 */

/**
 * Whether a health bar should show the low-health state.
 * True exactly when `max > 0` and `hp` is at or below 25% of `max`
 * (integer arithmetic: `hp * 100 <= 25 * max`). False when `max <= 0`.
 */
export const LOW_HEALTH_PERCENT = 25

export function isLowHealth(hp: number, max: number): boolean {
  if (!(max > 0)) return false
  return hp * 100 <= LOW_HEALTH_PERCENT * max
}

/** Visual state of a room marker in the room progress strip. */
export type RoomMarker = 'cleared' | 'current' | 'locked'

/**
 * Compute the marker state for a room.
 * `cleared` takes priority over `current`; any other room is `locked`.
 * `isBoss` is reported independently of the state.
 */
export function roomMarkerState(
  room: { id: string; is_boss?: boolean },
  currentId: string | null,
  clearedIds: readonly string[],
): { state: RoomMarker; isBoss: boolean } {
  let state: RoomMarker = 'locked'
  if (clearedIds.includes(room.id)) state = 'cleared'
  else if (currentId !== null && room.id === currentId) state = 'current'
  return { state, isBoss: room.is_boss === true }
}
