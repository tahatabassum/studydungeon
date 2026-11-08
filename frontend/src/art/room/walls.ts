import type { ThemePalette } from '@/game/world/roomTheme'
import { GATE, PILLARS, TILE, WORLD_H, WORLD_W, borderWallTiles } from '@/game/world/RoomLayout'
import { hex, rgba, shade } from './color'
import { createRng } from './rng'

export interface WallOptions {
  exitGap: boolean
  entryGap: boolean
}

const FACE = 10 // height of the shaded inner face strip, px
const SHADOW = 16 // soft shadow cast onto the floor, px

function arch(ctx: CanvasRenderingContext2D, palette: ThemePalette, cx: number, baseY: number, dir: 1 | -1): void {
  const half = GATE.w / 2
  const ry = 30
  // Dark opening.
  ctx.fillStyle = hex(palette.mortar)
  ctx.fillRect(cx - half, dir === 1 ? 0 : WORLD_H - TILE, GATE.w, TILE)
  // Stone arch bulging into the wall (lit stone, mortar seams).
  ctx.strokeStyle = hex(shade(palette.wallTop, 1.25))
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.ellipse(cx, baseY, half - 3, ry, 0, dir === 1 ? Math.PI : 0, dir === 1 ? Math.PI * 2 : Math.PI)
  ctx.stroke()
  ctx.strokeStyle = hex(palette.mortar)
  ctx.lineWidth = 1
  for (let i = 0; i <= 8; i++) {
    const a = (Math.PI * i) / 8
    const ax = Math.cos(a)
    const ay = -Math.sin(a) * dir
    ctx.beginPath()
    ctx.moveTo(cx + ax * (half - 6), baseY + ay * (ry - 3))
    ctx.lineTo(cx + ax * half, baseY + ay * (ry + 3))
    ctx.stroke()
  }
}

/**
 * Border walls with a lit top face, a shaded inner face and a soft floor shadow, plus pillar tops
 * and arched doorways at the exit (north) and entry (south) gaps. Deterministic for a seed.
 */
export function drawWalls(ctx: CanvasRenderingContext2D, palette: ThemePalette, opts: WallOptions, seed: number): void {
  const rng = createRng(seed)
  const top = palette.wallTop
  const inner = palette.wallInner

  // Wall blocks (top face) with brick seams.
  for (const t of borderWallTiles({ exitGap: opts.exitGap, entryGap: opts.entryGap })) {
    const x = t.x - TILE / 2
    const y = t.y - TILE / 2
    ctx.fillStyle = hex(shade(top, 0.9 + rng() * 0.2))
    ctx.fillRect(x, y, TILE, TILE)
    ctx.fillStyle = rgba(0xffffff, 0.08)
    ctx.fillRect(x, y, TILE, 2)
    ctx.fillStyle = hex(palette.mortar)
    ctx.fillRect(x, y + TILE / 2, TILE, 1)
    ctx.fillRect(x + (rng() < 0.5 ? 8 : 24), y, 1, TILE / 2)
    ctx.fillRect(x + 16, y + TILE / 2, 1, TILE / 2)
  }

  const gapL = GATE.x
  const gapR = GATE.x + GATE.w
  const strips = (y: number, h: number, gap: boolean, color: string): void => {
    ctx.fillStyle = color
    if (!gap) {
      ctx.fillRect(TILE, y, WORLD_W - 2 * TILE, h)
      return
    }
    ctx.fillRect(TILE, y, gapL - TILE, h)
    ctx.fillRect(gapR, y, WORLD_W - TILE - gapR, h)
  }

  // Shaded inner faces (the wall side that faces the room).
  strips(TILE - FACE, FACE, opts.exitGap, hex(inner))
  strips(WORLD_H - TILE, FACE, opts.entryGap, hex(inner))
  ctx.fillStyle = hex(inner)
  ctx.fillRect(TILE - FACE, TILE, FACE, WORLD_H - 2 * TILE)
  ctx.fillRect(WORLD_W - TILE, TILE, FACE, WORLD_H - 2 * TILE)

  // Soft shadow cast on the floor.
  const shadow = (x: number, y: number, w: number, h: number, vertical: boolean, flip: boolean): void => {
    const g = vertical
      ? ctx.createLinearGradient(0, flip ? y + h : y, 0, flip ? y : y + h)
      : ctx.createLinearGradient(flip ? x + w : x, 0, flip ? x : x + w, 0)
    g.addColorStop(0, 'rgba(0,0,0,0.45)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, y, w, h)
  }
  shadow(TILE, TILE, WORLD_W - 2 * TILE, SHADOW, true, false)
  shadow(TILE, WORLD_H - TILE - SHADOW, WORLD_W - 2 * TILE, SHADOW, true, true)
  shadow(TILE, TILE, SHADOW, WORLD_H - 2 * TILE, false, false)
  shadow(WORLD_W - TILE - SHADOW, TILE, SHADOW, WORLD_H - 2 * TILE, false, true)

  // Pillars: lit top face, shaded base face.
  for (const p of PILLARS) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(p.x + 4, p.y + p.h, p.w, 8)
    ctx.fillStyle = hex(shade(top, 1.05))
    ctx.fillRect(p.x, p.y, p.w, p.h - FACE)
    ctx.fillStyle = rgba(0xffffff, 0.1)
    ctx.fillRect(p.x, p.y, p.w, 3)
    ctx.fillStyle = hex(inner)
    ctx.fillRect(p.x, p.y + p.h - FACE, p.w, FACE)
    ctx.fillStyle = hex(palette.mortar)
    ctx.fillRect(p.x + p.w / 2, p.y, 1, p.h - FACE)
    ctx.fillRect(p.x, p.y + (p.h - FACE) / 2, p.w, 1)
  }

  // Arched doorways.
  const cx = GATE.x + GATE.w / 2
  if (opts.exitGap) arch(ctx, palette, cx, TILE + 2, 1)
  if (opts.entryGap) arch(ctx, palette, cx, WORLD_H - TILE - 2, -1)
}
