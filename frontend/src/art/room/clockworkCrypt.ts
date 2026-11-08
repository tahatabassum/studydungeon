import type { ThemePalette } from '@/game/world/roomTheme'
import { GATE, TILE, WORLD_H, WORLD_W } from '@/game/world/RoomLayout'
import { CRYPT_COFFINS, cryptProps } from '@/game/world/cryptProps'
import { hex, rgba, shade } from './color'

const BAND_TOP = TILE
const BAND_BOTTOM = 124

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: number, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, rgba(color, alpha))
  g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

/** Back wall elevation (y 32 to 128), broken at the doorway approach. */
function elevation(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
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
    // Brick courses.
    ctx.fillStyle = hex(p.mortar)
    for (let y = BAND_TOP + 16; y < BAND_BOTTOM; y += 16) ctx.fillRect(x0, y, x1 - x0, 1)
    for (let row = 0; row < 6; row++) {
      for (let x = x0 + (row % 2) * 16; x < x1; x += 32) ctx.fillRect(x, BAND_TOP + row * 16, 1, 16)
    }
    // Baseboard and floor shadow.
    ctx.fillStyle = hex(shade(p.wallTop, 1.1))
    ctx.fillRect(x0, BAND_BOTTOM, x1 - x0, 4)
    const sh = ctx.createLinearGradient(0, BAND_BOTTOM + 4, 0, BAND_BOTTOM + 20)
    sh.addColorStop(0, 'rgba(0,0,0,0.4)')
    sh.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = sh
    ctx.fillRect(x0, BAND_BOTTOM + 4, x1 - x0, 16)
  }
}

/** Broken clock face at (352, 64), radius 60: brass ring, cracked glass, missing numeral segments. */
function clockFace(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
  const cx = 352
  const cy = 64
  blob(ctx, cx, cy, 80, p.accentLight, 0.12)
  ctx.beginPath()
  ctx.arc(cx, cy, 60, 0, Math.PI * 2)
  ctx.fillStyle = '#2a2024'
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = hex(0x8a6a3a)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, 52, 0, Math.PI * 2)
  ctx.fillStyle = '#d8c9a8'
  ctx.fill()
  // Numeral ticks; hours 4, 5 and 9 are missing.
  ctx.strokeStyle = '#3a2c28'
  ctx.lineWidth = 3
  for (let h = 0; h < 12; h++) {
    if (h === 4 || h === 5 || h === 9) continue
    const a = (Math.PI * 2 * h) / 12 - Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40)
    ctx.lineTo(cx + Math.cos(a) * 49, cy + Math.sin(a) * 49)
    ctx.stroke()
  }
  // Missing chunk of face.
  ctx.fillStyle = '#17121a'
  ctx.beginPath()
  ctx.moveTo(cx + 20, cy + 52)
  ctx.lineTo(cx + 36, cy + 14)
  ctx.lineTo(cx + 12, cy + 24)
  ctx.lineTo(cx + 4, cy + 52)
  ctx.closePath()
  ctx.fill()
  // Cracked glass.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 1
  const cracks: Array<Array<[number, number]>> = [
    [[-6, -4], [-26, -22], [-44, -26]],
    [[-6, -4], [8, -30], [14, -50]],
    [[-6, -4], [-30, 10], [-38, 34]],
    [[-6, -4], [24, 6], [48, 0]],
  ]
  for (const c of cracks) {
    ctx.beginPath()
    ctx.moveTo(cx + c[0][0], cy + c[0][1])
    for (let i = 1; i < c.length; i++) ctx.lineTo(cx + c[i][0], cy + c[i][1])
    ctx.stroke()
  }
  ctx.fillStyle = hex(0x6a4a2a)
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()
}

/** Pendulum case x 928 to 976 with a glass sheen (the bob is an animated piece). */
function pendulumCase(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
  ctx.fillStyle = hex(shade(p.wallTop, 0.8))
  ctx.fillRect(926, BAND_TOP, 52, BAND_BOTTOM - BAND_TOP + 2)
  ctx.fillStyle = '#120e16'
  ctx.fillRect(930, BAND_TOP + 4, 44, BAND_BOTTOM - BAND_TOP - 6)
  const g = ctx.createLinearGradient(930, 0, 974, 0)
  g.addColorStop(0, 'rgba(255,255,255,0.0)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.12)')
  g.addColorStop(1, 'rgba(255,255,255,0.0)')
  ctx.fillStyle = g
  ctx.fillRect(930, BAND_TOP + 4, 44, BAND_BOTTOM - BAND_TOP - 6)
  ctx.fillStyle = hex(0x8a6a3a)
  ctx.fillRect(950, BAND_TOP + 4, 4, 4)
}

/** Pipe run x 760 to 1000 at y 24 to 40, with vents at x 800 and 960. */
function pipes(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 24, 0, 40)
  g.addColorStop(0, '#6c6272')
  g.addColorStop(0.45, '#9a8fa0')
  g.addColorStop(1, '#3a3340')
  ctx.fillStyle = g
  ctx.fillRect(760, 24, 240, 16)
  ctx.fillStyle = '#2a242e'
  for (const x of [772, 880, 988]) ctx.fillRect(x, 22, 4, 20)
  for (const x of [800, 960]) {
    ctx.fillStyle = '#4a4252'
    ctx.fillRect(x - 8, 40, 16, 6)
    ctx.fillStyle = '#17121a'
    ctx.fillRect(x - 5, 44, 10, 3)
  }
}

function cobweb(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, sx: 1 | -1, sy: 1 | -1): void {
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

/** Stone coffins with the lid ajar and a faint toxic glow in the gap. */
function coffins(ctx: CanvasRenderingContext2D, p: ThemePalette): void {
  for (const c of CRYPT_COFFINS) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(c.x + 3, c.y + c.h - 2, c.w, 8)
    ctx.fillStyle = hex(shade(p.wallTop, 0.75))
    ctx.fillRect(c.x, c.y, c.w, c.h)
    // Gap between body and shifted lid, glowing toxic green.
    blob(ctx, c.x + c.w / 2, c.y + 22, 36, 0x8be04e, 0.15)
    ctx.fillStyle = '#10200f'
    ctx.fillRect(c.x + 6, c.y + 10, c.w - 12, 14)
    // Lid, shifted off the body.
    ctx.fillStyle = hex(shade(p.wallTop, 1.0))
    ctx.fillRect(c.x - 2, c.y + 26, c.w + 4, c.h - 26)
    ctx.fillStyle = rgba(0xffffff, 0.1)
    ctx.fillRect(c.x - 2, c.y + 26, c.w + 4, 2)
    ctx.fillStyle = hex(p.mortar)
    ctx.fillRect(c.x + c.w / 2 - 1, c.y + 34, 2, c.h - 46)
    ctx.fillRect(c.x + 10, c.y + 50, c.w - 20, 2)
  }
}

/** Scatter props from the Prop_Placer (room-local top-left coordinates). */
function scatter(ctx: CanvasRenderingContext2D, seed: number): void {
  for (const p of cryptProps(seed)) {
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
      case 'rune':
        ctx.strokeStyle = 'rgba(192,75,214,0.45)'
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

/**
 * Baked static dressing for the Clockwork Crypt. Animated parts (clock hands, pendulum bob,
 * gears, steam, bats) are separate pooled pieces; this draws only what never moves.
 */
export function drawClockworkCrypt(ctx: CanvasRenderingContext2D, palette: ThemePalette, seed: number): void {
  blob(ctx, 352, 150, 70, 0xe9a23b, 0.06) // warm spill from the clock onto the floor
  elevation(ctx, palette)
  clockFace(ctx, palette)
  pendulumCase(ctx, palette)
  pipes(ctx)
  coffins(ctx, palette)
  scatter(ctx, seed)
  cobweb(ctx, TILE, TILE, 96, 1, 1)
  cobweb(ctx, WORLD_W - TILE, TILE, 96, -1, 1)
  cobweb(ctx, TILE, WORLD_H - TILE, 64, 1, -1)
  cobweb(ctx, WORLD_W - TILE, WORLD_H - TILE, 64, -1, -1)
}
