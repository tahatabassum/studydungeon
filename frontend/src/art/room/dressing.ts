import type { ThemePalette } from '@/game/world/roomTheme'
import { GATE, TILE, WORLD_H, WORLD_W } from '@/game/world/RoomLayout'
import type { PlacedProp } from '@/game/world/propPlacement'
import { hex, rgba, shade } from './color'

/** Shared building blocks for the baked room dressing (Phase 3 rooms). */
export const BAND_TOP = TILE
export const BAND_BOTTOM = 124

/** Soft radial glow blob drawn straight into the baked texture. */
export function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: number, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, rgba(color, alpha))
  g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

/** Back wall elevation (y 32 to 124), broken at the doorway approach. */
export function elevation(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
  const gapL = GATE.x - 16
  const gapR = GATE.x + GATE.w + 16
  const segs: Array<[number, number]> = [
    [TILE, gapL],
    [gapR, WORLD_W - TILE],
  ]
  for (const [x0, x1] of segs) {
    const g = ctx.createLinearGradient(0, BAND_TOP, 0, BAND_BOTTOM)
    g.addColorStop(0, hex(shade(p.wallInner, 1.1)))
    g.addColorStop(1, hex(shade(p.wallInner, 0.7)))
    ctx.fillStyle = g
    ctx.fillRect(x0, BAND_TOP, x1 - x0, BAND_BOTTOM - BAND_TOP)
    ctx.fillStyle = hex(p.mortar)
    for (let y = BAND_TOP + 16; y < BAND_BOTTOM; y += 16) ctx.fillRect(x0, y, x1 - x0, 1)
    for (let row = 0; row < 6; row++) {
      for (let x = x0 + (row % 2) * 16; x < x1; x += 32) ctx.fillRect(x, BAND_TOP + row * 16, 1, 16)
    }
    ctx.fillStyle = hex(shade(p.wallTop, 1.1))
    ctx.fillRect(x0, BAND_BOTTOM, x1 - x0, 4)
    const sh = ctx.createLinearGradient(0, BAND_BOTTOM + 4, 0, BAND_BOTTOM + 20)
    sh.addColorStop(0, 'rgba(0,0,0,0.4)')
    sh.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = sh
    ctx.fillRect(x0, BAND_BOTTOM + 4, x1 - x0, 16)
  }
}

export function cobweb(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, sx: 1 | -1, sy: 1 | -1): void {
  ctx.strokeStyle = 'rgba(235,230,245,0.28)'
  ctx.lineWidth = 1
  const rays = 5
  for (let i = 0; i < rays; i++) {
    const a = (Math.PI / 2) * (i / (rays - 1))
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * size * sx, y + Math.sin(a) * size * sy)
    ctx.stroke()
  }
  for (let r = size / 4; r <= size; r += size / 4) {
    ctx.beginPath()
    for (let i = 0; i < rays; i++) {
      const a = (Math.PI / 2) * (i / (rays - 1))
      const px = x + Math.cos(a) * r * sx
      const py = y + Math.sin(a) * r * sy
      if (i === 0) ctx.moveTo(px, py)
      else ctx.quadraticCurveTo(x + Math.cos(a - 0.2) * r * 0.8 * sx, y + Math.sin(a - 0.2) * r * 0.8 * sy, px, py)
    }
    ctx.stroke()
  }
}

/** Four corner cobwebs. */
export function cornerWebs(ctx: CanvasRenderingContext2D, big = 96, small = 64): void {
  cobweb(ctx, TILE, TILE, big, 1, 1)
  cobweb(ctx, WORLD_W - TILE, TILE, big, -1, 1)
  cobweb(ctx, TILE, WORLD_H - TILE, small, 1, -1)
  cobweb(ctx, WORLD_W - TILE, WORLD_H - TILE, small, -1, -1)
}

/** Arched window with a pale moon glow, used by the library and boss hall. */
export function archWindow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  w: number,
  topY: number,
  bottomY: number,
  frame: number,
  glow: number,
): void {
  const x0 = cx - w / 2
  // Elliptical arch so a wide window still fits the wall band.
  const archR = Math.min(w / 2, (bottomY - topY) * 0.55)
  const path = (inset: number): void => {
    ctx.beginPath()
    ctx.moveTo(x0 + inset, bottomY)
    ctx.lineTo(x0 + inset, topY + archR)
    ctx.ellipse(cx, topY + archR, w / 2 - inset, archR - inset, 0, Math.PI, 0)
    ctx.lineTo(x0 + w - inset, bottomY)
    ctx.closePath()
  }
  path(0)
  ctx.fillStyle = hex(frame)
  ctx.fill()
  path(5)
  const g = ctx.createLinearGradient(0, topY, 0, bottomY)
  g.addColorStop(0, '#2a3a66')
  g.addColorStop(1, '#6f86b8')
  ctx.fillStyle = g
  ctx.fill()
  // Moon disc and mullions.
  ctx.fillStyle = '#eef1ff'
  ctx.beginPath()
  ctx.arc(cx + w * 0.1, topY + archR + 4, Math.min(archR * 0.5, 22), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = hex(frame)
  ctx.fillRect(cx - 1, topY + archR, 2, bottomY - topY - archR)
  ctx.fillRect(x0 + 5, topY + archR + (bottomY - topY - archR) * 0.5, w - 10, 2)
  blob(ctx, cx, bottomY, w, glow, 0.14)
}

/** A faint light beam falling from a window down onto the floor (baked, no animation). */
export function beam(ctx: CanvasRenderingContext2D, cx: number, topW: number, y0: number, y1: number, color: number): void {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, rgba(color, 0.16))
  g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(cx - topW / 2, y0)
  ctx.lineTo(cx + topW / 2, y0)
  ctx.lineTo(cx + topW * 1.1, y1)
  ctx.lineTo(cx - topW * 0.3, y1)
  ctx.closePath()
  ctx.fill()
}

/** Wooden table with an optional lit candle on top (top-left rect). */
export function table(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, wood: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fillRect(x + 3, y + h - 2, w, 8)
  ctx.fillStyle = hex(shade(wood, 0.6))
  ctx.fillRect(x + 4, y + h - 14, 8, 14)
  ctx.fillRect(x + w - 12, y + h - 14, 8, 14)
  ctx.fillStyle = hex(wood)
  ctx.fillRect(x, y, w, h - 10)
  ctx.fillStyle = rgba(0xffffff, 0.1)
  ctx.fillRect(x, y, w, 2)
  ctx.fillStyle = hex(shade(wood, 0.7))
  ctx.fillRect(x, y + h - 12, w, 2)
}

export function banner(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number, color: number): void {
  ctx.fillStyle = '#2a2024'
  ctx.fillRect(x - 3, y0, w + 6, 3)
  ctx.fillStyle = hex(color)
  ctx.beginPath()
  ctx.moveTo(x, y0 + 3)
  ctx.lineTo(x + w, y0 + 3)
  ctx.lineTo(x + w, y1)
  ctx.lineTo(x + w / 2, y1 - 10)
  ctx.lineTo(x, y1)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = rgba(0xf2e8d5, 0.55)
  ctx.beginPath()
  ctx.arc(x + w / 2, y0 + 26, 6, 0, Math.PI * 2)
  ctx.fill()
}

/** Scatter props from the Prop_Placer, drawn for every Phase 3 room (room-local top-left). */
export function drawScatter(ctx: CanvasRenderingContext2D, props: readonly PlacedProp[], runeColor: number): void {
  for (const p of props) {
    const cx = p.x + p.w / 2
    const cy = p.y + p.h / 2
    switch (p.kind) {
      case 'bone':
        ctx.fillStyle = '#e8dfc8'
        ctx.fillRect(p.x, p.y + 2, p.w, 2)
        ctx.fillRect(p.x, p.y, 3, 6)
        ctx.fillRect(p.x + p.w - 3, p.y, 3, 6)
        break
      case 'candle':
        blob(ctx, cx, p.y + 2, 18, 0xe9a23b, 0.18)
        ctx.fillStyle = '#e9dfc4'
        ctx.fillRect(p.x + 1, p.y + 4, p.w - 2, p.h - 4)
        ctx.fillStyle = '#ffcf6a'
        ctx.fillRect(p.x + 3, p.y, 2, 4)
        break
      case 'paper':
        ctx.fillStyle = '#cdbf9f'
        ctx.fillRect(p.x, p.y, p.w, p.h)
        ctx.fillStyle = 'rgba(40,30,30,0.5)'
        for (let y = p.y + 2; y < p.y + p.h - 1; y += 3) ctx.fillRect(p.x + 2, y, p.w - 5, 1)
        break
      case 'fallen_book':
        ctx.fillStyle = '#5a2a3c'
        ctx.fillRect(p.x, p.y, p.w, p.h)
        ctx.fillStyle = '#d8c9a8'
        ctx.fillRect(p.x + 2, p.y + p.h - 3, p.w - 3, 2)
        ctx.fillStyle = '#c9a24a'
        ctx.fillRect(p.x + 3, p.y + 2, p.w - 8, 1)
        break
      case 'vial':
        ctx.fillStyle = 'rgba(180,230,200,0.5)'
        ctx.fillRect(p.x + 2, p.y, p.w - 4, 4)
        ctx.fillStyle = '#5fcf86'
        ctx.fillRect(p.x, p.y + 4, p.w, p.h - 4)
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.fillRect(p.x + 1, p.y + 5, 2, p.h - 7)
        break
      case 'mini_pumpkin':
        ctx.fillStyle = '#c9661a'
        ctx.beginPath()
        ctx.ellipse(cx, cy + 1, p.w / 2, p.h / 2 - 1, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#e9852a'
        ctx.fillRect(cx - 4, p.y + 3, 3, p.h - 7)
        ctx.fillStyle = '#3a5a2a'
        ctx.fillRect(cx - 1, p.y, 3, 4)
        break
      case 'straw':
        ctx.strokeStyle = '#c9a24a'
        ctx.lineWidth = 1
        for (let i = 0; i < 4; i++) {
          ctx.beginPath()
          ctx.moveTo(p.x + i * 4, p.y + p.h)
          ctx.lineTo(p.x + i * 4 + 5, p.y + (i % 2) * 2)
          ctx.stroke()
        }
        break
      case 'rune':
        ctx.strokeStyle = rgba(runeColor, 0.45)
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, 20, 0, Math.PI * 2)
        ctx.stroke()
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx - 14, cy + 10)
        ctx.lineTo(cx, cy - 16)
        ctx.lineTo(cx + 14, cy + 10)
        ctx.closePath()
        ctx.stroke()
        break
      default:
        break
    }
  }
}
