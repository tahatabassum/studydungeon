import { createRng, randInt } from '@/art/room/rng'
import { TILE, WORLD_H, WORLD_W, type Rect } from './RoomLayout'

export interface PropSize {
  w: number
  h: number
}
export interface PlacedProp {
  kind: string
  x: number
  y: number
  w: number
  h: number
}
export interface PropKind {
  kind: string
  size: PropSize
  count: number
}

const MAX_ATTEMPTS = 200

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/**
 * Seeded scatter placement (room-local top-left coordinates). Props stay inside the interior
 * (inside the border wall ring), outside every blocked rect, and never overlap each other.
 * A prop that cannot be placed within MAX_ATTEMPTS is skipped. Pure; adds no physics.
 */
export function placeProps(seed: number, kinds: readonly PropKind[], blocked: readonly Rect[]): PlacedProp[] {
  const rng = createRng(seed)
  const placed: PlacedProp[] = []
  for (const k of kinds) {
    const { w, h } = k.size
    const maxX = WORLD_W - TILE - w
    const maxY = WORLD_H - TILE - h
    if (maxX < TILE || maxY < TILE) continue
    for (let n = 0; n < k.count; n++) {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const rect: Rect = { x: randInt(rng, TILE, maxX), y: randInt(rng, TILE, maxY), w, h }
        if (blocked.some((b) => intersects(rect, b))) continue
        if (placed.some((p) => intersects(rect, p))) continue
        placed.push({ kind: k.kind, ...rect })
        break
      }
    }
  }
  return placed
}
