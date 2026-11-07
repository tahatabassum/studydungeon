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

/** Options for per-room helpers. All optional; defaults match the single-room slice. */
export interface RoomOptions {
  /** Top-left corner of the room in world coordinates. Default (0, 0). */
  origin?: Point
  /** Gap in the top wall (exit gate). Default true. */
  exitGap?: boolean
  /** Gap in the bottom wall (entry passage). Default false. */
  entryGap?: boolean
}

function resolve(opts: RoomOptions): { ox: number; oy: number; exitGap: boolean; entryGap: boolean } {
  return {
    ox: opts.origin?.x ?? 0,
    oy: opts.origin?.y ?? 0,
    exitGap: opts.exitGap ?? true,
    entryGap: opts.entryGap ?? false,
  }
}

/** Border wall tiles, skipping gate/entry gaps. Returns tile centers. */
export function borderWallTiles(opts: RoomOptions = {}): Point[] {
  const { ox, oy, exitGap, entryGap } = resolve(opts)
  const cols = WORLD_W / TILE
  const rows = WORLD_H / TILE
  const out: Point[] = []
  for (let c = 0; c < cols; c++) {
    const x = c * TILE
    const inGap = x >= GATE.x && x < GATE.x + GATE.w
    if (!(exitGap && inGap)) out.push({ x: ox + x + TILE / 2, y: oy + TILE / 2 })
    if (!(entryGap && inGap)) out.push({ x: ox + x + TILE / 2, y: oy + WORLD_H - TILE / 2 })
  }
  for (let r = 1; r < rows - 1; r++) {
    out.push({ x: ox + TILE / 2, y: oy + r * TILE + TILE / 2 })
    out.push({ x: ox + WORLD_W - TILE / 2, y: oy + r * TILE + TILE / 2 })
  }
  return out
}

/** Pillars translated to a room origin. */
export function pillarsFor(opts: RoomOptions = {}): Rect[] {
  const { ox, oy } = resolve(opts)
  return PILLARS.map((p) => ({ ...p, x: p.x + ox, y: p.y + oy }))
}

/** Torches translated to a room origin. */
export function torchesFor(opts: RoomOptions = {}): Point[] {
  const { ox, oy } = resolve(opts)
  return TORCHES.map((t) => ({ x: t.x + ox, y: t.y + oy }))
}
