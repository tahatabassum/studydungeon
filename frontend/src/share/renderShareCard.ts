import { COLORS, toCss } from '../game/colors'
import { badgeLabels, cleanName, shareRank, shareScore, SHARE_HASHTAG, type ShareData } from './postText'

/** Share card size (Req 15.5). */
export const CARD_W = 1200
export const CARD_H = 630

/** Self-hosted @fontsource families (D18). */
const DISPLAY = '"Pirata One", serif'
const LABEL = '"Cinzel", serif'
const BODY = '"Inter", sans-serif'

const FONT_SPECS = ['400 72px "Pirata One"', '700 32px "Cinzel"', '400 28px "Cinzel"', '600 24px "Inter"', '400 24px "Inter"']

/** Waits for the bundled fonts before drawing. Without the Font Loading API (tests) it resolves at once. */
export async function loadShareFonts(): Promise<void> {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts
  if (!fonts || typeof fonts.load !== 'function') return
  try {
    await Promise.all(FONT_SPECS.map((spec) => fonts.load(spec, 'StudyDungeon 0123456789')))
  } catch {
    /* a font that fails to load falls back to the generic family in the stack */
  }
}

const css = toCss

function fitText(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxPx: number, minPx: number, width: number): number {
  let px = maxPx
  ctx.font = font(px)
  while (px > minPx && ctx.measureText(text).width > width) {
    px -= 2
    ctx.font = font(px)
  }
  return px
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, CARD_H)
  sky.addColorStop(0, css(COLORS.INDIGO))
  sky.addColorStop(0.7, css(COLORS.BG))
  sky.addColorStop(1, css(COLORS.BG))
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // Moon with a halo.
  const halo = ctx.createRadialGradient(980, 150, 10, 980, 150, 190)
  halo.addColorStop(0, `${css(COLORS.BONE)}55`)
  halo.addColorStop(1, `${css(COLORS.BONE)}00`)
  ctx.fillStyle = halo
  ctx.fillRect(760, 0, 440, 360)
  ctx.fillStyle = css(COLORS.BONE)
  ctx.beginPath()
  ctx.arc(980, 150, 62, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = css(COLORS.INDIGO)
  ctx.beginPath()
  ctx.arc(1004, 136, 56, 0, Math.PI * 2)
  ctx.fill()

  // Stars on a fixed pattern: the card is deterministic.
  ctx.fillStyle = css(COLORS.BONE)
  for (let i = 0; i < 46; i++) {
    const x = (i * 211 + 37) % CARD_W
    const y = (i * 97 + 19) % 300
    ctx.globalAlpha = 0.25 + ((i * 13) % 5) * 0.12
    ctx.fillRect(x, y, 2, 2)
  }
  ctx.globalAlpha = 1

  // Crypt silhouette along the bottom: a jagged skyline of tombstones and a leaning tower.
  ctx.fillStyle = css(COLORS.SURFACE_2)
  ctx.beginPath()
  ctx.moveTo(0, CARD_H)
  ctx.lineTo(0, 560)
  for (let x = 0; x <= CARD_W; x += 100) {
    const h = 556 + ((x / 100) % 3) * 12
    ctx.lineTo(x + 10, h)
    ctx.arc(x + 40, h, 30, Math.PI, 0)
    ctx.lineTo(x + 70, h + 8)
  }
  ctx.lineTo(CARD_W, CARD_H)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = css(COLORS.PANEL)
  ctx.fillRect(0, 596, CARD_W, 34)

  // Soft vignette.
  const vig = ctx.createRadialGradient(CARD_W / 2, CARD_H / 2, 260, CARD_W / 2, CARD_H / 2, 760)
  vig.addColorStop(0, `${css(COLORS.BG)}00`)
  vig.addColorStop(1, `${css(COLORS.BG)}cc`)
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, CARD_W, CARD_H)
}

function drawFrame(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = css(COLORS.GOLD)
  ctx.lineWidth = 6
  ctx.strokeRect(18, 18, CARD_W - 36, CARD_H - 36)
  ctx.strokeStyle = css(COLORS.MAGIC)
  ctx.lineWidth = 2
  ctx.strokeRect(30, 30, CARD_W - 60, CARD_H - 60)
  ctx.fillStyle = css(COLORS.GOLD)
  for (const [x, y] of [[18, 18], [CARD_W - 18, 18], [18, CARD_H - 18], [CARD_W - 18, CARD_H - 18]] as const) {
    ctx.beginPath()
    ctx.moveTo(x, y - 14)
    ctx.lineTo(x + 14, y)
    ctx.lineTo(x, y + 14)
    ctx.lineTo(x - 14, y)
    ctx.closePath()
    ctx.fill()
  }
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number): void {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function drawBadges(ctx: CanvasRenderingContext2D, labels: readonly string[]): void {
  const shown = labels.slice(0, 6)
  if (shown.length === 0) {
    ctx.textAlign = 'left'
    ctx.fillStyle = css(COLORS.INK_MUTED)
    ctx.font = `400 26px ${BODY}`
    ctx.fillText('No badges this time. The crypt is patient.', 80, 470)
    return
  }
  const slot = 150
  shown.forEach((label, i) => {
    const cx = 80 + slot / 2 + i * slot
    const cy = 450
    const g = ctx.createRadialGradient(cx - 8, cy - 8, 4, cx, cy, 34)
    g.addColorStop(0, css(COLORS.BONE))
    g.addColorStop(0.6, css(COLORS.GOLD))
    g.addColorStop(1, css(COLORS.EMBER))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, 34, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = css(COLORS.BG)
    star(ctx, cx, cy, 18, 8)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.fillStyle = css(COLORS.INK)
    const px = fitText(ctx, label, (p) => `600 ${p}px ${BODY}`, 20, 13, slot - 14)
    ctx.font = `600 ${px}px ${BODY}`
    ctx.fillText(label, cx, cy + 62)
  })
  if (labels.length > shown.length) {
    ctx.textAlign = 'left'
    ctx.fillStyle = css(COLORS.INK_MUTED)
    ctx.font = `600 22px ${BODY}`
    ctx.fillText(`+${labels.length - shown.length} more`, 80 + shown.length * slot + 6, 458)
  }
}

/**
 * Draws the share card: 1200x630, code-drawn art only, self-hosted fonts only (D18). No network, no images.
 * Resolves once the card is on the canvas. Throws when the canvas has no 2D context.
 */
export async function renderShareCard(data: ShareData, canvas: HTMLCanvasElement): Promise<void> {
  await loadShareFonts()
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')

  drawBackground(ctx)
  drawFrame(ctx)

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  ctx.fillStyle = css(COLORS.PUMPKIN)
  ctx.font = `400 60px ${DISPLAY}`
  ctx.fillText('StudyDungeon', 80, 112)

  const name = cleanName(data.dungeonName)
  ctx.fillStyle = css(COLORS.BONE)
  const namePx = fitText(ctx, name, (p) => `700 ${p}px ${LABEL}`, 40, 22, 760)
  ctx.font = `700 ${namePx}px ${LABEL}`
  ctx.fillText(name, 80, 172)

  ctx.fillStyle = css(COLORS.INK_MUTED)
  ctx.font = `400 24px ${BODY}`
  ctx.fillText('Dungeon cleared', 80, 208)

  // Score.
  ctx.fillStyle = css(COLORS.INK_MUTED)
  ctx.font = `700 24px ${LABEL}`
  ctx.fillText('SCORE', 80, 288)
  ctx.fillStyle = css(COLORS.GOLD)
  ctx.font = `400 120px ${DISPLAY}`
  ctx.fillText(String(shareScore(data.score)), 80, 390)

  // Rank seal on the right.
  const rank = shareRank(data.rank)
  const sealX = 930
  const sealY = 400
  if (rank || data.floorRank) {
    ctx.strokeStyle = css(COLORS.GOLD)
    ctx.lineWidth = 5
    ctx.fillStyle = css(COLORS.BG)
    ctx.beginPath()
    ctx.arc(sealX, sealY, 92, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.textAlign = 'center'
    if (rank) {
      ctx.fillStyle = css(COLORS.INK_MUTED)
      ctx.font = `700 22px ${LABEL}`
      ctx.fillText('RANK', sealX, sealY - 34)
      ctx.fillStyle = css(COLORS.GOLD)
      ctx.font = `400 ${rank >= 1000 ? 56 : 72}px ${DISPLAY}`
      ctx.fillText(`#${rank}`, sealX, sealY + 36)
    } else {
      ctx.fillStyle = css(COLORS.INK_MUTED)
      ctx.font = `700 22px ${LABEL}`
      ctx.fillText('FLOOR', sealX, sealY - 34)
      ctx.fillStyle = css(COLORS.GOLD)
      ctx.font = `400 84px ${DISPLAY}`
      ctx.fillText(String(data.floorRank), sealX, sealY + 40)
    }
    ctx.textAlign = 'left'
  }

  drawBadges(ctx, badgeLabels(data.badges))

  ctx.textAlign = 'right'
  ctx.fillStyle = css(COLORS.TOXIC)
  ctx.font = `700 26px ${LABEL}`
  ctx.fillText(SHARE_HASHTAG, CARD_W - 80, CARD_H - 52)
  ctx.textAlign = 'left'
}

/** `canvas.toBlob` as a promise: PNG, or null when the browser could not encode it. */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    } catch {
      resolve(null)
    }
  })
}
