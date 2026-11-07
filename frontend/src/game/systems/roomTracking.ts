/** Pure room-change detection. No Phaser import. */
import type { DungeonLayout } from '../world/DungeonLayout'
import { roomAt } from '../world/DungeonLayout'
import type { Point } from '../world/RoomLayout'

/**
 * Returns the new current room id when it differs from `prevId`
 * (including the first call with prevId null), otherwise null.
 * A point outside every room never produces an event.
 */
export function nextRoomEvent(
  prevId: string | null,
  point: Point,
  layout: DungeonLayout,
): string | null {
  const id = roomAt(layout, point)
  return id !== null && id !== prevId ? id : null
}
