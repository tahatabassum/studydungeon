import type { ThemePalette } from '@/game/world/roomTheme'
import { WITCH_FIXED, roomProps } from '@/game/world/roomProps'
import { BAND_BOTTOM, BAND_TOP, blob, cornerWebs, drawScatter, elevation, table } from './dressing'
import { hex, shade } from './color'
import { createRng, randInt, type Rng } from './rng'

const POTIONS = [0x8be04e, 0xc04bd6, 0x68c9a5, 0xe9a23b, 0x7546a8]

/** A potion shelf: planks with bottles in seeded colors. */
function potionShelf(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rng: Rng): void {
  ctx.fillStyle = '#3a2a20'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#120d12'
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6)
  const rows = Math.max(2, Math.floor(h / 34))
  const rowH = (h - 6) / rows
  for (let r = 0; r < rows; r++) {
    const base = y + 3 + r * rowH + rowH - 3
    for (let bx = x + 6; bx < x + w - 10; bx += 12) {
      const c = POTIONS[randInt(rng, 0, POTIONS.length - 1)]
      const bh = randInt(rng, 10, Math.floor(rowH) - 6)
      ctx.fillStyle = hex(shade(c, 0.7))
      ctx.fillRect(bx, base - bh, 8, bh)
      ctx.fillStyle = hex(c)
      ctx.fillRect(bx + 1, base - bh + 3, 3, bh - 4)
      ctx.fillStyle = '#c9b18a'
      ctx.fillRect(bx + 2, base - bh - 3, 4, 3)
    }
    ctx.fillStyle = '#4a3a2c'
    ctx.fillRect(x + 2, base, w - 4, 3)
  }
}

/** A glass jar on a shelf (the floating eye or spark inside is an animated piece). */
function jar(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  blob(ctx, cx, cy, 24, 0x8be04e, 0.18)
  ctx.fillStyle = 'rgba(150,230,190,0.28)'
  ctx.fillRect(cx - 11, cy - 14, 22, 28)
  ctx.strokeStyle = 'rgba(220,255,235,0.55)'
  ctx.lineWidth = 1
  ctx.strokeRect(cx - 11, cy - 14, 22, 28)
  ctx.fillStyle = '#4a3a2c'
  ctx.fillRect(cx - 12, cy - 18, 24, 5)
}

function herbs(ctx: CanvasRenderingContext2D, x: number): void {
  ctx.strokeStyle = '#c9b18a'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, BAND_TOP)
  ctx.lineTo(x, BAND_TOP + 18)
  ctx.stroke()
  ctx.fillStyle = '#3c5c45'
  ctx.beginPath()
  ctx.moveTo(x - 7, BAND_TOP + 18)
  ctx.lineTo(x + 7, BAND_TOP + 18)
  ctx.lineTo(x + 3, BAND_TOP + 52)
  ctx.lineTo(x - 3, BAND_TOP + 52)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#5a8a4a'
  ctx.fillRect(x - 5, BAND_TOP + 22, 2, 18)
  ctx.fillRect(x + 2, BAND_TOP + 26, 2, 16)
}

function cauldron(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  blob(ctx, x + w / 2, y + 20, 110, 0x8be04e, 0.14)
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.beginPath()
  ctx.ellipse(x + w / 2, y + h - 2, w / 2 + 6, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  // Legs and iron body.
  ctx.fillStyle = '#17121a'
  ctx.fillRect(x + 12, y + h - 12, 10, 12)
  ctx.fillRect(x + w - 22, y + h - 12, 10, 12)
  ctx.beginPath()
  ctx.ellipse(x + w / 2, y + h * 0.58, w / 2, h * 0.4, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#2a242e'
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.beginPath()
  ctx.ellipse(x + w * 0.35, y + h * 0.5, w * 0.12, h * 0.2, 0, 0, Math.PI * 2)
  ctx.fill()
  // Rim and bubbling green brew.
  ctx.fillStyle = '#4a4252'
  ctx.beginPath()
  ctx.ellipse(x + w / 2, y + h * 0.28, w * 0.44, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#6fd04a'
  ctx.beginPath()
  ctx.ellipse(x + w / 2, y + h * 0.28, w * 0.38, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#b8f07a'
  ctx.fillRect(x + w * 0.4, y + h * 0.24, 6, 2)
}

/**
 * Baked static dressing for the Witch's Laboratory: a glowing green cauldron, potion shelves, hanging
 * herbs, jars, a workbench, cobwebs and scatter props. Bubbles and the jar contents are animated.
 */
export function drawWitchLab(ctx: CanvasRenderingContext2D, palette: ThemePalette, seed: number): void {
  const rng = createRng(seed ^ 0x77c)
  elevation(ctx, palette)
  potionShelf(ctx, 48, BAND_TOP + 4, 460, BAND_BOTTOM - BAND_TOP - 6, rng)
  potionShelf(ctx, 752, BAND_TOP + 4, 480, BAND_BOTTOM - BAND_TOP - 6, rng)
  jar(ctx, 110, 82)
  jar(ctx, 430, 82)
  for (const x of [330, 380, 820, 870]) herbs(ctx, x)
  const [pot, bench, rackW, rackE] = WITCH_FIXED
  cauldron(ctx, pot.x, pot.y, pot.w, pot.h)
  table(ctx, bench.x, bench.y, bench.w, bench.h, 0x4a3a2c)
  blob(ctx, bench.x + bench.w / 2, bench.y - 4, 60, 0xc04bd6, 0.2) // purple glow from the bench
  ctx.fillStyle = '#c04bd6'
  ctx.fillRect(bench.x + 20, bench.y - 10, 8, 10)
  ctx.fillStyle = '#8be04e'
  ctx.fillRect(bench.x + 70, bench.y - 8, 8, 8)
  potionShelf(ctx, rackW.x, rackW.y, rackW.w, rackW.h, rng)
  potionShelf(ctx, rackE.x, rackE.y, rackE.w, rackE.h, rng)
  drawScatter(ctx, roomProps('witch_lab', seed), 0x8be04e)
  cornerWebs(ctx)
}
