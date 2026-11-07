/** Pure, deterministic dungeon layout builder. No Phaser import. */
import { GATE, TILE, WORLD_H as ROOM_H, WORLD_W as ROOM_W } from './RoomLayout'
import type { Point, Rect } from './RoomLayout'

export interface RoomInput {
  id: string
  order: number
  is_boss?: boolean
}
export interface RoomBounds {
  id: string
  order: number
  isBoss: boolean
  rect: Rect
}
export interface GateSpec {
  afterRoomId: string
  toRoomId: string
  /** Gate barrier in the top wall of the earlier room. */
  rect: Rect
  /** Matching opening in the bottom wall of the later room. */
  passage: Rect
}
export interface DungeonLayout {
  rooms: RoomBounds[]
  gates: GateSpec[]
  world: Rect
  spawn: Point
}
export type LayoutError = 'empty' | 'duplicate-order'
export type LayoutResult = { ok: true; layout: DungeonLayout } | { ok: false; error: LayoutError }

/**
 * Rooms are stacked bottom to top in ascending `order`. Each room is
 * ROOM_W x ROOM_H. The boss (expected last) simply has no exit gate because
 * gates are only created between consecutive rooms.
 */
export function buildDungeonLayout(rooms: readonly RoomInput[]): LayoutResult {
  if (rooms.length === 0) return { ok: false, error: 'empty' }
  const sorted = [...rooms].sort((a, b) => a.order - b.order)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].order === sorted[i - 1].order) return { ok: false, error: 'duplicate-order' }
  }
  const n = sorted.length
  const bounds: RoomBounds[] = sorted.map((r, k) => ({
    id: r.id,
    order: r.order,
    isBoss: r.is_boss === true,
    rect: { x: 0, y: (n - 1 - k) * ROOM_H, w: ROOM_W, h: ROOM_H },
  }))
  const gates: GateSpec[] = []
  for (let k = 0; k < n - 1; k++) {
    const cur = bounds[k].rect
    const next = bounds[k + 1].rect
    gates.push({
      afterRoomId: bounds[k].id,
      toRoomId: bounds[k + 1].id,
      rect: { x: GATE.x, y: cur.y, w: GATE.w, h: TILE },
      passage: { x: GATE.x, y: next.y + ROOM_H - TILE, w: GATE.w, h: TILE },
    })
  }
  const first = bounds[0].rect
  return {
    ok: true,
    layout: {
      rooms: bounds,
      gates,
      world: { x: 0, y: 0, w: ROOM_W, h: n * ROOM_H },
      spawn: { x: first.x + ROOM_W / 2, y: first.y + ROOM_H - 3 * TILE },
    },
  }
}

/** Id of the room containing the point (half-open intervals), or null. */
export function roomAt(layout: DungeonLayout, p: Point): string | null {
  for (const r of layout.rooms) {
    const { x, y, w, h } = r.rect
    if (p.x >= x && p.x < x + w && p.y >= y && p.y < y + h) return r.id
  }
  return null
}
