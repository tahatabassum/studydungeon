import type { Point } from '../world/RoomLayout'

/**
 * Interaction range in pixels, measured between the CENTERS of the player and monster.
 * The player body radius is 10 and the monster collision box is 32x32 (half 16), so when
 * the two bodies touch the centers are about 26 to 30 px apart. A 64 px center distance
 * therefore leaves roughly 34 px of slack: the player can always reach it by walking up
 * to the monster, from any side.
 */
export const INTERACTION_RANGE = 64

export function isWithinRange(a: Point, b: Point, range: number = INTERACTION_RANGE): boolean {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy <= range * range
}
