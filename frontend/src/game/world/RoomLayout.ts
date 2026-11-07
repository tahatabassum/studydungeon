/** Pure layout constants and helpers for the room. No Phaser import. */
export const TILE = 32
export const WORLD_W = 1280
export const WORLD_H = 800

export interface Point {
  x: number
  y: number
}
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const PLAYER_SPAWN: Point = { x: WORLD_W / 2, y: WORLD_H - 3 * TILE }
export const MONSTER_SPAWN: Point = { x: WORLD_W / 2, y: WORLD_H / 2 - 2 * TILE }

/** Gate sits in a gap in the top wall (centered on x, spans the top wall row). */
export const GATE: Rect = { x: WORLD_W / 2 - 2 * TILE, y: 0, w: 4 * TILE, h: TILE }

/** Inner pillars (top-left x/y, size), kept clear of the spawn points. */
export const PILLARS: Rect[] = [
  { x: 5 * TILE, y: 5 * TILE, w: 2 * TILE, h: 2 * TILE },
  { x: WORLD_W - 7 * TILE, y: 5 * TILE, w: 2 * TILE, h: 2 * TILE },
  { x: 5 * TILE, y: WORLD_H - 7 * TILE, w: 2 * TILE, h: 2 * TILE },
  { x: WORLD_W - 7 * TILE, y: WORLD_H - 7 * TILE, w: 2 * TILE, h: 2 * TILE },
]

/** Torch positions along the walls. */
export const TORCHES: Point[] = [
  { x: 8 * TILE, y: TILE + 8 },
  { x: WORLD_W - 8 * TILE, y: TILE + 8 },
  { x: TILE + 8, y: WORLD_H / 2 },
  { x: WORLD_W - TILE - 8, y: WORLD_H / 2 },
]

/** Border wall tiles, skipping the gate gap. Returns tile centers. */
export function borderWallTiles(): Point[] {
  const cols = WORLD_W / TILE
  const rows = WORLD_H / TILE
  const out: Point[] = []
  for (let c = 0; c < cols; c++) {
    const x = c * TILE
    const inGate = x >= GATE.x && x < GATE.x + GATE.w
    if (!inGate) out.push({ x: x + TILE / 2, y: TILE / 2 })
    out.push({ x: x + TILE / 2, y: WORLD_H - TILE / 2 })
  }
  for (let r = 1; r < rows - 1; r++) {
    out.push({ x: TILE / 2, y: r * TILE + TILE / 2 })
    out.push({ x: WORLD_W - TILE / 2, y: r * TILE + TILE / 2 })
  }
  return out
}
