import type { ThemePalette } from '@/game/world/roomTheme'
import { GATE, TILE, WORLD_H, WORLD_W } from '@/game/world/RoomLayout'
import { hex, rgba, shade } from './color'
import { createRng, randInt, type Rng } from './rng'

const MOSS = [0x2f4a3a, 0x33503d, 0x3c5c45]
const CRACKS = 14
const MOSS_BLOTS = 18
const STAINS = 6

/** Soft radial blob. */
function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: number, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, rgba(color, alpha))
  g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function crack(ctx: CanvasRenderingContext2D, rng: Rng, color: number): void {
  let x = randInt(rng, TILE * 2, WORLD_W - TILE * 2)
  let y = randInt(rng, TILE * 2, WORLD_H - TILE * 2)
  ctx.beginPath()
  ctx.moveTo(x, y)
  const segs = randInt(rng, 3, 6)
  for (let i = 0; i < segs; i++) {
    x += randInt(rng, -18, 18)
    y += randInt(rng, 6, 20) * (rng() < 0.5 ? -1 : 1)
    ctx.lineTo(x, y)
  }
  ctx.strokeStyle = rgba(color, 0.55)
  ctx.lineWidth = 1
  ctx.stroke()
}

/**
 * Seeded dark flagstone floor: per-tile tone, seams, cracks, moss, stains, worn corridor edges.
 * Deterministic for a given seed and palette.
 */
export function drawFloor(ctx: CanvasRenderingContext2D, palette: ThemePalette, seed: number): void {
  const rng = createRng(seed)
  const cols = WORLD_W / TILE
  const rows = WORLD_H / TILE
  const tones = palette.floorTones.length > 0 ? palette.floorTones : [palette.floorBase]

  ctx.fillStyle = hex(palette.mortar)
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)

  // Flagstones with per-tile tone and a small brightness jitter.
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const base = tones[Math.floor(rng() * tones.length)]
      const jitter = 0.9 + rng() * 0.2
      ctx.fillStyle = hex(shade(base, jitter))
      ctx.fillRect(c * TILE + 1, r * TILE + 1, TILE - 1, TILE - 1)
      // Lit top-left rim (seam highlight).
      ctx.fillStyle = rgba(0xffffff, 0.04)
      ctx.fillRect(c * TILE + 1, r * TILE + 1, TILE - 1, 1)
      ctx.fillRect(c * TILE + 1, r * TILE + 1, 1, TILE - 1)
    }
  }

  // Wear strip: a lighter path along the corridor so the route reads as the route.
  const cx = GATE.x + GATE.w / 2
  ctx.fillStyle = rgba(0xffe9c8, 0.05)
  ctx.fillRect(cx - 96, TILE, 192, WORLD_H - 2 * TILE)
  ctx.fillStyle = rgba(0xffe9c8, 0.07)
  ctx.fillRect(cx - 96, TILE, 3, WORLD_H - 2 * TILE)
  ctx.fillRect(cx + 93, TILE, 3, WORLD_H - 2 * TILE)

  // Cracks.
  for (let i = 0; i < CRACKS; i++) crack(ctx, rng, 0x000000)

  // Moss along the walls and scattered in cracks.
  for (let i = 0; i < MOSS_BLOTS; i++) {
    const side = i % 4
    const along = rng()
    const x = side === 0 ? TILE + 8 : side === 1 ? WORLD_W - TILE - 8 : TILE * 2 + along * (WORLD_W - TILE * 4)
    const y = side === 2 ? TILE + 8 : side === 3 ? WORLD_H - TILE - 8 : TILE * 2 + along * (WORLD_H - TILE * 4)
    blob(ctx, x, y, randInt(rng, 14, 30), MOSS[i % MOSS.length], 0.5)
  }

  // Dark stains (multiplied into the stone).
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  for (let i = 0; i < STAINS; i++) {
    blob(ctx, randInt(rng, 120, WORLD_W - 120), randInt(rng, 120, WORLD_H - 120), randInt(rng, 28, 56), 0x1a1020, 0.7)
  }
  ctx.restore()
}
