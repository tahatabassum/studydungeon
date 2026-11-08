import { TILE, WORLD_H, WORLD_W, type Point } from '../world/RoomLayout'

/** Distance (between centers) within which the player can engage a Revenant. */
export const REVENANT_RANGE = 72

/** Hovering height of the body above its resting point, in world px. */
export const REVENANT_HOVER = 6

/** Keep spawn hints clear of the border walls. */
const MARGIN = 3 * TILE

/** Rows of the 3 slots: flanks sit lower than the middle one so the trio forms a shallow arc. */
const SLOT_Y = [WORLD_H * 0.56, WORLD_H * 0.47, WORLD_H * 0.56]

/**
 * Resting points for `count` (0 to 3) Revenants in a room whose top-left corner is `origin`.
 * They sit in a shallow arc where the room monster stood and never overlap the pillars; they have no
 * collider, so they never block the walk to the exit gate. An optional room-relative x hint is clamped inside the walls.
 * Pure and deterministic.
 */
export function revenantSlots(count: number, origin: Point, hints: ReadonlyArray<number | undefined> = []): Point[] {
  const n = Math.max(0, Math.min(3, Math.floor(count)))
  const xs: Record<number, number[]> = {
    0: [],
    1: [-300],
    2: [-300, 300],
    3: [-380, 0, 380],
  }
  const out: Point[] = []
  for (let i = 0; i < n; i++) {
    const hint = hints[i]
    const rel = hint !== undefined && Number.isFinite(hint) ? hint : WORLD_W / 2 + xs[n][i]
    const x = Math.min(WORLD_W - MARGIN, Math.max(MARGIN, rel))
    const y = n === 3 ? SLOT_Y[i] : SLOT_Y[0]
    out.push({ x: origin.x + x, y: origin.y + y })
  }
  return out
}
