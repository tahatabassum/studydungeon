import type { ThemePalette } from '@/game/world/roomTheme'
import { PUMPKIN_FIXED, roomProps } from '@/game/world/roomProps'
import { BAND_BOTTOM, BAND_TOP, blob, cornerWebs, drawScatter, elevation, table } from './dressing'

/** Jack-o'-lantern body with a carved face; the lit glow on the face is an animated piece. */
function jackOLantern(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const cx = x + w / 2
  const cy = y + h / 2 + 2
  blob(ctx, cx, cy, 70, 0xf28a1e, 0.16)
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  ctx.ellipse(cx, y + h, w / 2 + 4, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#b8560f'
  ctx.beginPath()
  ctx.ellipse(cx, cy, w / 2, h / 2 - 2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e07a1a'
  ctx.beginPath()
  ctx.ellipse(cx, cy, w * 0.32, h / 2 - 2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#2f4a22'
  ctx.fillRect(cx - 2, y - 2, 5, 7)
  // Carved, lit face.
  ctx.fillStyle = '#ffd25a'
  ctx.beginPath()
  ctx.moveTo(cx - 14, cy - 8)
  ctx.lineTo(cx - 5, cy - 8)
  ctx.lineTo(cx - 10, cy - 15)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + 14, cy - 8)
  ctx.lineTo(cx + 5, cy - 8)
  ctx.lineTo(cx + 10, cy - 15)
  ctx.closePath()
  ctx.fill()
  ctx.fillRect(cx - 14, cy + 6, 28, 4)
  ctx.fillStyle = '#b8560f'
  ctx.fillRect(cx - 8, cy + 6, 3, 4)
  ctx.fillRect(cx + 4, cy + 6, 3, 4)
}

function hay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fillRect(x + 3, y + h - 2, w, 6)
  ctx.fillStyle = '#b8903a'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#d8b050'
  for (let i = 0; i < w; i += 6) ctx.fillRect(x + i, y + (i % 12 === 0 ? 2 : 6), 3, h - 8)
  ctx.fillStyle = '#6a4a1a'
  ctx.fillRect(x, y + h * 0.35, w, 3)
  ctx.fillRect(x, y + h * 0.7, w, 3)
}

function scarecrow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const cx = x + w / 2
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fillRect(x + 8, y + h - 2, w - 10, 6)
  ctx.fillStyle = '#4a3220' // post and arms
  ctx.fillRect(cx - 3, y + 20, 6, h - 20)
  ctx.fillRect(x - 2, y + 40, w + 4, 6)
  ctx.fillStyle = '#5a2a3c' // shirt
  ctx.fillRect(cx - 14, y + 36, 28, 34)
  ctx.fillStyle = '#c9a24a' // straw hands
  ctx.fillRect(x - 6, y + 44, 8, 6)
  ctx.fillRect(x + w - 2, y + 44, 8, 6)
  ctx.fillStyle = '#d8b050' // head
  ctx.beginPath()
  ctx.arc(cx, y + 26, 11, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a1220'
  ctx.fillRect(cx - 6, y + 22, 3, 3)
  ctx.fillRect(cx + 3, y + 22, 3, 3)
  ctx.fillRect(cx - 5, y + 31, 10, 2)
  ctx.fillStyle = '#2a1e3a' // hat
  ctx.fillRect(cx - 16, y + 14, 32, 4)
  ctx.beginPath()
  ctx.moveTo(cx - 10, y + 14)
  ctx.lineTo(cx, y - 8)
  ctx.lineTo(cx + 10, y + 14)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#f28a1e'
  ctx.fillRect(cx - 10, y + 10, 20, 3)
}

/** Pegboard of hanging tools on the north wall. */
function toolWall(ctx: CanvasRenderingContext2D, x0: number, x1: number): void {
  ctx.fillStyle = '#3a2a20'
  ctx.fillRect(x0, BAND_TOP + 6, x1 - x0, BAND_BOTTOM - BAND_TOP - 12)
  ctx.fillStyle = '#4a3828'
  for (let x = x0 + 4; x < x1 - 4; x += 10) ctx.fillRect(x, BAND_TOP + 8, 2, BAND_BOTTOM - BAND_TOP - 16)
  ctx.fillStyle = '#9a8fa0'
  for (let x = x0 + 16, i = 0; x < x1 - 20; x += 44, i++) {
    ctx.fillStyle = '#6a4a2a'
    ctx.fillRect(x, BAND_TOP + 14, 4, 48)
    ctx.fillStyle = '#9a8fa0'
    if (i % 3 === 0) ctx.fillRect(x - 8, BAND_TOP + 12, 20, 8) // axe or hoe head
    else if (i % 3 === 1) {
      ctx.fillRect(x - 6, BAND_TOP + 12, 4, 14) // pitchfork tines
      ctx.fillRect(x + 6, BAND_TOP + 12, 4, 14)
      ctx.fillRect(x - 6, BAND_TOP + 12, 16, 3)
    } else ctx.fillRect(x - 3, BAND_TOP + 56, 10, 14) // bucket
  }
}

/**
 * Baked static dressing for the Pumpkin Workshop: three jack-o'-lanterns, hay bales, a scarecrow,
 * wall tools, a workbench, cobwebs and scatter props. The face glow and embers are animated.
 */
export function drawPumpkinWorkshop(ctx: CanvasRenderingContext2D, palette: ThemePalette, seed: number): void {
  elevation(ctx, palette)
  toolWall(ctx, 60, 500)
  toolWall(ctx, 780, 1210)
  const [j1, j2, j3, hayA, hayB, scare, bench] = PUMPKIN_FIXED
  hay(ctx, hayA.x, hayA.y, hayA.w, hayA.h)
  hay(ctx, hayB.x, hayB.y, hayB.w, hayB.h)
  scarecrow(ctx, scare.x, scare.y, scare.w, scare.h)
  table(ctx, bench.x, bench.y, bench.w, bench.h, 0x5a4030)
  for (const j of [j1, j2, j3]) jackOLantern(ctx, j.x, j.y, j.w, j.h)
  blob(ctx, 640, 90, 160, 0xf28a1e, 0.05) // warm spill on the north wall
  drawScatter(ctx, roomProps('pumpkin_workshop', seed), 0xf28a1e)
  cornerWebs(ctx, 80, 56)
}
