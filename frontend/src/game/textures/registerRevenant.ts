import type Phaser from 'phaser'
import { rgba } from '@/art/room/color'
import { COLORS } from '../colors'
import { REVENANT } from '../revenantLook'

export const REVENANT_TEXTURE = 'revenant'
export const REVENANT_W = 96
export const REVENANT_H = 128

/** A question mark from strokes, centred on (x, y), `s` px tall. */
function questionMark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, style: string): void {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = style
  ctx.fillStyle = style
  ctx.lineWidth = Math.max(1.5, s * 0.13)
  ctx.beginPath()
  ctx.arc(x, y - s * 0.22, s * 0.28, -Math.PI * 0.92, Math.PI * 0.5)
  ctx.lineTo(x, y + s * 0.12)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y + s * 0.36, s * 0.07, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * Paints the Revenant once: a hooded, translucent wisp-wraith with a tattered tail, hollow face with two
 * glowing eyes, a faint question-mark rune on its chest and a torn page drifting at its side. It is
 * distinct from every monster by silhouette (no legs, no feet) and by its cold cyan and violet light.
 * Safe to call more than once; draws in code, no asset files.
 */
export function registerRevenant(scene: Phaser.Scene): void {
  if (scene.textures.exists(REVENANT_TEXTURE)) return
  const tex = scene.textures.createCanvas(REVENANT_TEXTURE, REVENANT_W, REVENANT_H)
  if (!tex) return
  const ctx = tex.getContext()
  const cx = REVENANT_W / 2
  ctx.clearRect(0, 0, REVENANT_W, REVENANT_H)

  // Wisp tail curling to the right under the body.
  ctx.beginPath()
  ctx.moveTo(cx - 14, 92)
  ctx.bezierCurveTo(cx - 6, 112, cx + 14, 112, cx + 24, 124)
  ctx.bezierCurveTo(cx + 12, 118, cx + 2, 124, cx - 8, 118)
  ctx.bezierCurveTo(cx - 2, 108, cx + 10, 104, cx + 14, 92)
  ctx.closePath()
  ctx.fillStyle = rgba(REVENANT.VIOLET, 0.35)
  ctx.fill()

  // Shroud with a ragged hem.
  const body = (): void => {
    ctx.beginPath()
    ctx.moveTo(cx, 6)
    ctx.bezierCurveTo(cx + 22, 6, cx + 34, 26, cx + 34, 50)
    ctx.bezierCurveTo(cx + 36, 68, cx + 40, 84, cx + 38, 100)
    ctx.lineTo(cx + 30, 94)
    ctx.lineTo(cx + 22, 106)
    ctx.lineTo(cx + 12, 96)
    ctx.lineTo(cx + 2, 110)
    ctx.lineTo(cx - 8, 97)
    ctx.lineTo(cx - 18, 108)
    ctx.lineTo(cx - 28, 95)
    ctx.lineTo(cx - 38, 102)
    ctx.bezierCurveTo(cx - 40, 84, cx - 36, 68, cx - 34, 50)
    ctx.bezierCurveTo(cx - 34, 26, cx - 22, 6, cx, 6)
    ctx.closePath()
  }
  body()
  const g = ctx.createLinearGradient(0, 6, 0, 112)
  g.addColorStop(0, rgba(0xeafaff, 0.95))
  g.addColorStop(0.5, rgba(REVENANT.CYAN, 0.7))
  g.addColorStop(1, rgba(REVENANT.VIOLET, 0.1))
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = rgba(0xffffff, 0.45)
  ctx.stroke()

  // Hollow face.
  ctx.beginPath()
  ctx.ellipse(cx, 36, 15, 19, 0, 0, Math.PI * 2)
  ctx.fillStyle = rgba(COLORS.BG, 0.93)
  ctx.fill()
  for (const dx of [-6, 6]) {
    const eye = ctx.createRadialGradient(cx + dx, 34, 0, cx + dx, 34, 6)
    eye.addColorStop(0, 'rgba(255,255,255,1)')
    eye.addColorStop(0.4, rgba(REVENANT.CYAN, 0.95))
    eye.addColorStop(1, rgba(REVENANT.CYAN, 0))
    ctx.fillStyle = eye
    ctx.fillRect(cx + dx - 7, 27, 14, 14)
  }
  ctx.beginPath()
  ctx.ellipse(cx, 48, 3.5, 5, 0, 0, Math.PI * 2)
  ctx.fillStyle = rgba(COLORS.BG, 0.9)
  ctx.fill()

  // Rune: a ring with a question mark.
  ctx.lineWidth = 1.5
  ctx.strokeStyle = rgba(REVENANT.VIOLET, 0.9)
  ctx.beginPath()
  ctx.arc(cx, 74, 12, 0, Math.PI * 2)
  ctx.stroke()
  questionMark(ctx, cx, 74, 17, rgba(0xffffff, 0.95))

  // Torn page drifting at the side.
  ctx.save()
  ctx.translate(cx + 38, 70)
  ctx.rotate(0.35)
  ctx.beginPath()
  ctx.moveTo(-8, -11)
  ctx.lineTo(3, -12)
  ctx.lineTo(8, -7)
  ctx.lineTo(6, 0)
  ctx.lineTo(9, 7)
  ctx.lineTo(2, 12)
  ctx.lineTo(-3, 9)
  ctx.lineTo(-9, 12)
  ctx.lineTo(-10, 2)
  ctx.closePath()
  ctx.fillStyle = rgba(COLORS.BONE, 0.82)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = rgba(REVENANT.DEEP, 0.7)
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(-6, -6 + i * 5)
    ctx.lineTo(4, -6 + i * 5)
    ctx.stroke()
  }
  ctx.restore()

  tex.refresh()
}
