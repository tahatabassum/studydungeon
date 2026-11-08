import type { ThemePalette } from '@/game/world/roomTheme'
import { LIBRARY_FIXED, roomProps } from '@/game/world/roomProps'
import { BAND_BOTTOM, BAND_TOP, archWindow, beam, blob, cornerWebs, drawScatter, elevation, table } from './dressing'
import { hex, shade } from './color'
import { createRng, randInt, type Rng } from './rng'

const SPINES = [0x5a2a3c, 0x2f4a3f, 0x4a3446, 0x6a4a2a, 0x3a3a6a, 0x7a3a2a, 0x8a6a3a]
const WOOD = 0x3a2a20

/** A shelf unit filled with seeded book spines; vertical when it stands against a side wall. */
function shelf(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rng: Rng): void {
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fillRect(x + 3, y + h - 2, w, 6)
  ctx.fillStyle = hex(WOOD)
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#120d12'
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6)
  const rows = Math.max(2, Math.floor(h / 28))
  const rowH = (h - 6) / rows
  for (let r = 0; r < rows; r++) {
    const top = y + 3 + r * rowH
    let bx = x + 4
    while (bx < x + w - 6) {
      const bw = randInt(rng, 3, 6)
      const bh = randInt(rng, Math.floor(rowH * 0.6), Math.floor(rowH) - 3)
      ctx.fillStyle = hex(SPINES[randInt(rng, 0, SPINES.length - 1)])
      ctx.fillRect(bx, top + rowH - 3 - bh, bw, bh)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(bx, top + rowH - 3 - bh, 1, bh)
      bx += bw + 1
    }
    ctx.fillStyle = hex(shade(WOOD, 1.2))
    ctx.fillRect(x + 2, top + rowH - 3, w - 4, 3)
  }
}

function openBook(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#d8c9a8'
  ctx.fillRect(x, y, 14, 8)
  ctx.fillRect(x + 15, y, 14, 8)
  ctx.fillStyle = 'rgba(40,30,30,0.5)'
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + 2, y + 2 + i * 2, 10, 1)
    ctx.fillRect(x + 17, y + 2 + i * 2, 10, 1)
  }
}

/**
 * Baked static dressing for the Haunted Library: towering shelves, an arched moonlight window with
 * two light beams, tables with open books, cobwebs and scatter props. Floating candles, drifting
 * pages and ghost books are animated pieces.
 */
export function drawLibrary(ctx: CanvasRenderingContext2D, palette: ThemePalette, seed: number): void {
  const rng = createRng(seed ^ 0x11b)
  elevation(ctx, palette)
  // Towering shelves along the north wall, either side of the window (window x 900 to 980).
  for (const [x, w] of [
    [48, 190],
    [280, 240],
    [756, 130],
    [1000, 232],
  ] as const) {
    shelf(ctx, x, BAND_TOP + 2, w, BAND_BOTTOM - BAND_TOP - 2, rng)
  }
  archWindow(ctx, 940, 80, BAND_TOP + 2, BAND_BOTTOM + 4, 0x4a3446, 0x68c9a5)
  beam(ctx, 940, 60, BAND_BOTTOM + 4, 360, 0xcfe0ff)
  beam(ctx, 910, 36, BAND_BOTTOM + 4, 300, 0xcfe0ff)
  blob(ctx, 940, 200, 120, 0x68c9a5, 0.07) // cool moon pool on the floor
  // Side shelves.
  for (const r of LIBRARY_FIXED.slice(0, 4)) shelf(ctx, r.x, r.y, r.w, r.h, rng)
  // Reading tables with open books.
  for (const r of LIBRARY_FIXED.slice(4)) {
    table(ctx, r.x, r.y, r.w, r.h, 0x5a4030)
    openBook(ctx, r.x + r.w / 2 - 15, r.y - 6)
  }
  drawScatter(ctx, roomProps('library', seed), 0xc04bd6)
  cornerWebs(ctx)
}
