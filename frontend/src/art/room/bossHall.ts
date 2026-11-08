import type { ThemePalette } from '@/game/world/roomTheme'
import { BOSS_FIXED, roomProps } from '@/game/world/roomProps'
import { BAND_BOTTOM, archWindow, banner, beam, blob, cornerWebs, drawScatter, elevation } from './dressing'

function throne(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  blob(ctx, x + w / 2, y + h / 2, 90, 0xf2e8d5, 0.08)
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(x + 4, y + h - 2, w, 8)
  // Bone-white high back with a pointed crest, seat and arms.
  ctx.fillStyle = '#d8cdb4'
  ctx.beginPath()
  ctx.moveTo(x + 8, y + h * 0.6)
  ctx.lineTo(x + 8, y + 12)
  ctx.lineTo(x + w / 2, y - 6)
  ctx.lineTo(x + w - 8, y + 12)
  ctx.lineTo(x + w - 8, y + h * 0.6)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#f2e8d5'
  ctx.fillRect(x + 14, y + 18, w - 28, h * 0.4)
  ctx.fillStyle = '#4a1a2a' // cushion
  ctx.fillRect(x + 16, y + h * 0.5, w - 32, 16)
  ctx.fillStyle = '#d8cdb4'
  ctx.fillRect(x, y + h * 0.55, 14, h * 0.45)
  ctx.fillRect(x + w - 14, y + h * 0.55, 14, h * 0.45)
  ctx.fillStyle = '#8a7e66' // rib shading
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 20 + i * 11, y + 22, 2, h * 0.3)
  ctx.fillStyle = '#17121a' // skull crest eyes
  ctx.fillRect(x + w / 2 - 8, y + 4, 5, 5)
  ctx.fillRect(x + w / 2 + 3, y + 4, 5, 5)
}

function lectern(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(x + 3, y + h - 2, w, 6)
  ctx.fillStyle = '#2a1e24'
  ctx.fillRect(x + 14, y + 30, w - 28, h - 30)
  ctx.fillStyle = '#3a2a30'
  ctx.fillRect(x, y + 18, w, 16)
  ctx.fillStyle = '#d8c9a8' // giant tome
  ctx.fillRect(x + 4, y + 6, w - 8, 14)
  ctx.fillStyle = '#7546a8'
  ctx.fillRect(x + w / 2 - 1, y + 6, 2, 14)
  blob(ctx, x + w / 2, y + 10, 36, 0xc04bd6, 0.18)
}

/** Chandelier ring and chains (the purple flames are animated pieces). */
function chandelier(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  blob(ctx, cx, cy, 80, 0xc04bd6, 0.1)
  ctx.strokeStyle = '#4a4252'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cx, 124)
  ctx.lineTo(cx, cy - 18)
  ctx.stroke()
  ctx.strokeStyle = '#6c6272'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.ellipse(cx, cy, 44, 12, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#4a4252'
  for (const dx of [-26, 0, 26]) ctx.fillRect(cx + dx - 2, cy - 10 + (dx === 0 ? -2 : 4), 4, 8)
  ctx.fillStyle = '#f2e8d5'
  for (const dx of [-26, 0, 26]) ctx.fillRect(cx + dx - 2, cy - 12 + (dx === 0 ? -2 : 4), 4, 4)
}

/**
 * Baked static dressing for the Boss Hall: a giant moon window, banners, a bone throne, a tome
 * lectern, chandelier rings, heavy cobwebs and scatter props. Purple flames, fog and lightning
 * are animated pieces and atmosphere.
 */
export function drawBossHall(ctx: CanvasRenderingContext2D, palette: ThemePalette, seed: number): void {
  elevation(ctx, palette)
  archWindow(ctx, 880, 200, 36, BAND_BOTTOM + 4, 0x5a2a3c, 0xcfe0ff)
  beam(ctx, 880, 120, BAND_BOTTOM + 4, 400, 0xcfe0ff)
  beam(ctx, 840, 50, BAND_BOTTOM + 4, 320, 0xcfe0ff)
  blob(ctx, 880, 200, 160, 0xcfe0ff, 0.06)
  for (const [x, c] of [
    [120, 0xb83d4a],
    [410, 0x7546a8],
    [1130, 0xb83d4a],
  ] as const) {
    banner(ctx, x, 34, 112, 44, c)
  }
  const [t, l, c1, c2] = BOSS_FIXED
  throne(ctx, t.x, t.y, t.w, t.h)
  lectern(ctx, l.x, l.y, l.w, l.h)
  chandelier(ctx, c1.x + c1.w / 2, c1.y + c1.h / 2)
  chandelier(ctx, c2.x + c2.w / 2, c2.y + c2.h / 2)
  drawScatter(ctx, roomProps('boss_hall', seed), 0xc04bd6)
  cornerWebs(ctx, 120, 80)
}
