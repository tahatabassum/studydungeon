/**
 * Shared Canvas2D helpers for the code-drawn portraits. Pure drawing code: no React, no Phaser.
 * Colours come from the palette tokens in src/game/colors.ts; shading is derived with mix().
 */
import { COLORS } from '@/game/colors'
import { PORTRAIT_H, PORTRAIT_W, type Pose } from './types'

export type Ctx = CanvasRenderingContext2D
export type EyeMode = 'open' | 'wide' | 'squint' | 'angry' | 'closed' | 'x'
export type MouthMode = 'closed' | 'open' | 'ooh' | 'grin' | 'frown'

/** Horizontal centre of every figure. */
export const CX = PORTRAIT_W / 2

export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}
export const lighten = (c: number, t: number): number => mix(c, 0xffffff, t)
export const darken = (c: number, t: number): number => mix(c, 0x000000, t)

/** 0xRRGGBB to a CSS colour, with optional alpha. */
export function css(n: number, a = 1): string {
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return a >= 1 ? `#${n.toString(16).padStart(6, '0')}` : `rgba(${r},${g},${b},${Math.max(0, a)})`
}

export function lin(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Array<[number, string]>): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  for (const [t, c] of stops) g.addColorStop(t, c)
  return g
}

export function rad(ctx: Ctx, x: number, y: number, r0: number, r1: number, stops: Array<[number, string]>): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1)
  for (const [t, c] of stops) g.addColorStop(t, c)
  return g
}

/** Soft additive-looking glow disc. */
export function glow(ctx: Ctx, x: number, y: number, r: number, color: number, alpha: number): void {
  if (alpha <= 0) return
  ctx.fillStyle = rad(ctx, x, y, 0, r, [
    [0, css(color, alpha)],
    [1, css(color, 0)],
  ])
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, rot = 0): void {
  ctx.beginPath()
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/**
 * Fills a shape and gives it volume: a light rim on the upper left and a soft shade on the lower right,
 * both clipped to the shape. `path` must build (not fill) the outline.
 */
export function shape(ctx: Ctx, path: () => void, fill: string | CanvasGradient, rim: number | null = null, shade = 0.28): void {
  path()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.save()
  path()
  ctx.clip()
  ctx.lineJoin = 'round'
  ctx.translate(7, 9)
  path()
  ctx.lineWidth = 14
  ctx.strokeStyle = css(COLORS.BG, shade)
  ctx.stroke()
  ctx.translate(-14, -18)
  if (rim !== null) {
    path()
    ctx.lineWidth = 7
    ctx.strokeStyle = css(rim, 0.7)
    ctx.stroke()
  }
  ctx.restore()
}

export function line(ctx: Ctx, pts: Array<[number, number]>, color: string, width: number, close = false): void {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  if (close) ctx.closePath()
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.stroke()
}

export function polygon(ctx: Ctx, pts: Array<[number, number]>, fill: string | CanvasGradient): void {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

/** Toothed wheel centred at (cx, cy). */
export function gear(ctx: Ctx, cx: number, cy: number, rOut: number, rIn: number, teeth: number, rot: number, fill: string | CanvasGradient, hole: number): void {
  ctx.beginPath()
  const step = (Math.PI * 2) / teeth
  for (let i = 0; i < teeth; i++) {
    const a = rot + i * step
    const pts: Array<[number, number]> = [
      [rIn, a - step * 0.28],
      [rOut, a - step * 0.16],
      [rOut, a + step * 0.16],
      [rIn, a + step * 0.28],
    ]
    pts.forEach(([r, ang], j) => {
      const x = cx + Math.cos(ang) * r
      const y = cy + Math.sin(ang) * r
      if (i === 0 && j === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, hole, 0, Math.PI * 2)
  ctx.fillStyle = css(COLORS.BG, 0.85)
  ctx.fill()
}

/** One expressive, glowing eye. side is 1 for the left eye, -1 for the right eye. */
export function drawEye(ctx: Ctx, x: number, y: number, r: number, mode: EyeMode, color: number, glowK: number, side: 1 | -1, lid: number): void {
  if (mode === 'closed') {
    ctx.beginPath()
    ctx.arc(x, y - r * 0.2, r * 0.95, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.lineWidth = Math.max(3, r * 0.4)
    ctx.lineCap = 'round'
    ctx.strokeStyle = css(color, 0.8)
    ctx.stroke()
    return
  }
  if (mode === 'x') {
    const k = r * 0.8
    line(ctx, [[x - k, y - k], [x + k, y + k]], css(color, 0.75), Math.max(3, r * 0.4))
    line(ctx, [[x + k, y - k], [x - k, y + k]], css(color, 0.75), Math.max(3, r * 0.4))
    return
  }
  if (mode === 'squint') {
    glow(ctx, x, y, r * 3, color, 0.3 * glowK)
    line(
      ctx,
      [[x - side * r, y - r * 0.85], [x + side * r, y], [x - side * r, y + r * 0.85]],
      css(lighten(color, 0.3)),
      Math.max(3.5, r * 0.45),
    )
    return
  }
  const rr = mode === 'wide' ? r * 1.25 : r
  glow(ctx, x, y, rr * 3.4, color, 0.5 * glowK)
  ellipse(
    ctx,
    x,
    y,
    rr,
    rr * 1.12,
    rad(ctx, x, y - rr * 0.2, 0, rr * 1.2, [
      [0, css(lighten(color, 0.85))],
      [0.45, css(lighten(color, 0.2))],
      [1, css(darken(color, 0.25))],
    ]),
  )
  ellipse(ctx, x + side * rr * 0.05, y + rr * 0.1, rr * 0.28, rr * 0.55, css(COLORS.BG, 0.8))
  ellipse(ctx, x - rr * 0.35, y - rr * 0.4, rr * 0.22, rr * 0.22, 'rgba(255,255,255,0.9)')
  if (mode === 'angry') {
    polygon(
      ctx,
      [
        [x - side * rr * 1.5, y - rr * 0.95],
        [x + side * rr * 1.5, y + rr * 0.05],
        [x + side * rr * 1.5, y - rr * 1.9],
        [x - side * rr * 1.5, y - rr * 1.9],
      ],
      css(lid),
    )
  }
}

export interface MouthColors {
  line: number
  inside: number
  tooth: number
  fangs?: boolean
}

export function drawMouth(ctx: Ctx, x: number, y: number, w: number, mode: MouthMode, c: MouthColors): void {
  const lineCss = css(c.line)
  if (mode === 'closed') {
    ctx.beginPath()
    ctx.moveTo(x - w / 2, y)
    ctx.quadraticCurveTo(x, y + w * 0.16, x + w / 2, y)
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.strokeStyle = lineCss
    ctx.stroke()
    if (c.fangs) {
      polygon(ctx, [[x - w * 0.3, y + 2], [x - w * 0.2, y + 2], [x - w * 0.25, y + w * 0.17]], css(c.tooth))
      polygon(ctx, [[x + w * 0.3, y + 2], [x + w * 0.2, y + 2], [x + w * 0.25, y + w * 0.17]], css(c.tooth))
    }
    return
  }
  if (mode === 'frown') {
    ctx.beginPath()
    ctx.moveTo(x - w / 2, y + 6)
    ctx.quadraticCurveTo(x, y - w * 0.22, x + w / 2, y + 6)
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.strokeStyle = lineCss
    ctx.stroke()
    return
  }
  if (mode === 'ooh') {
    ellipse(ctx, x, y + 6, w * 0.17, w * 0.2, css(c.inside))
    ctx.lineWidth = 3
    ctx.strokeStyle = lineCss
    ctx.stroke()
    return
  }
  const open = mode === 'open'
  const hOpen = open ? w * 0.5 : w * 0.34
  ctx.beginPath()
  ctx.moveTo(x - w / 2, y)
  ctx.quadraticCurveTo(x, y + hOpen * 2, x + w / 2, y)
  ctx.quadraticCurveTo(x, y + (open ? -4 : 6), x - w / 2, y)
  ctx.closePath()
  ctx.fillStyle = css(c.inside)
  ctx.fill()
  ctx.lineWidth = 3.5
  ctx.lineJoin = 'round'
  ctx.strokeStyle = lineCss
  ctx.stroke()
  // Upper teeth strip.
  ctx.fillStyle = css(c.tooth)
  ctx.fillRect(x - w * 0.34, y + 1, w * 0.68, open ? 7 : 5)
  if (c.fangs) {
    polygon(ctx, [[x - w * 0.32, y + 1], [x - w * 0.2, y + 1], [x - w * 0.26, y + w * 0.2]], css(c.tooth))
    polygon(ctx, [[x + w * 0.32, y + 1], [x + w * 0.2, y + 1], [x + w * 0.26, y + w * 0.2]], css(c.tooth))
  }
}

export interface PoseSpec {
  eyes: EyeMode
  mouth: MouthMode
  /** Vertical offset of the whole figure (positive moves it down). */
  dy: number
  /** Lean in radians, pivoting at the bottom centre. */
  tilt: number
  /** Eye glow multiplier. */
  glow: number
  /** Jaw drop in px for characters with a hinged jaw. */
  jaw: number
  /** Overlay colour for hurt (red) and defeated (dark), or null. */
  tint: number | null
  tintAlpha: number
  pose: Pose
  /** Uniform scale about the bottom centre (leaning in or shrinking back). */
  scale: number
  /** How far the arms reach forward or rise, 0 to 1. */
  reach: number
}

export function poseSpec(pose: Pose): PoseSpec {
  switch (pose) {
    case 'talking':
      return { eyes: 'open', mouth: 'open', dy: 2, tilt: 0.012, glow: 1.15, jaw: 16, tint: null, tintAlpha: 0, pose, scale: 1.045, reach: 0.55 }
    case 'hurt':
      return { eyes: 'squint', mouth: 'ooh', dy: 12, tilt: -0.07, glow: 0.8, jaw: 8, tint: COLORS.DANGER, tintAlpha: 0.3, pose, scale: 0.96, reach: 0.15 }
    case 'taunt':
      return { eyes: 'angry', mouth: 'grin', dy: -6, tilt: 0.04, glow: 1.7, jaw: 22, tint: null, tintAlpha: 0, pose, scale: 1.08, reach: 1 }
    case 'defeated':
      return { eyes: 'x', mouth: 'frown', dy: 60, tilt: 0.14, glow: 0.15, jaw: 4, tint: COLORS.BG, tintAlpha: 0.45, pose, scale: 0.94, reach: 0 }
    default:
      return { eyes: 'open', mouth: 'closed', dy: 0, tilt: 0, glow: 1, jaw: 0, tint: null, tintAlpha: 0, pose, scale: 1, reach: 0.25 }
  }
}

/** Small seeded generator (mulberry32) so every redraw of a character is identical. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Pt = [number, number]

/** A jagged torn edge from x0 to x1 along y; tips drop by up to `depth` (negative depth tears upward). */
export function tatterPts(x0: number, x1: number, y: number, n: number, depth: number, seed: number): Pt[] {
  const r = rng(seed)
  const pts: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n
    pts.push([x + (r() - 0.5) * ((x1 - x0) / n) * 0.3, y + (i % 2 === 0 ? depth * (0.35 + r() * 0.65) : depth * r() * 0.15)])
  }
  return pts
}

/** Menacing slit-shaped eye with bloom. The slant follows the side of the figure (inner end low). */
export function menaceEye(ctx: Ctx, x: number, y: number, r: number, color: number, s: PoseSpec, slant = 0.35): void {
  const dead = s.pose === 'defeated'
  const k = s.pose === 'taunt' ? 1.35 : s.pose === 'hurt' ? 0.8 : 1
  glow(ctx, x, y, r * (dead ? 2.5 : 5.2 * k), color, dead ? 0.12 : 0.6 * Math.min(1.4, s.glow))
  if (dead) {
    ellipse(ctx, x, y, r * 0.5, r * 0.18, css(darken(color, 0.4), 0.7))
    return
  }
  const w = r * 1.5 * k
  const h = (s.pose === 'hurt' ? 0.22 : s.pose === 'taunt' ? 0.8 : 0.55) * r * k
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((x < CX ? 1 : -1) * slant)
  ctx.beginPath()
  ctx.moveTo(-w, 0)
  ctx.quadraticCurveTo(0, -h * 2, w, 0)
  ctx.quadraticCurveTo(0, h * 2, -w, 0)
  ctx.closePath()
  ctx.fillStyle = rad(ctx, 0, 0, 0, w, [
    [0, 'rgba(255,255,255,1)'],
    [0.35, css(lighten(color, 0.6))],
    [1, css(color)],
  ])
  ctx.fill()
  ctx.restore()
}

/** Clawed hand: a palm with four hooked, pointed fingers fanned around `ang` (radians, 0 = right). */
export function claw(ctx: Ctx, x: number, y: number, ang: number, len: number, w: number, fill: string, nail: string): void {
  ellipse(ctx, x, y, w * 0.9, w * 0.75, fill, ang)
  for (let i = 0; i < 4; i++) {
    const a = ang + (i - 1.5) * 0.3
    const fl = len * (i === 1 || i === 2 ? 1 : 0.82)
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const px = -dy
    const py = dx
    const bx = x + dx * w * 0.55
    const by = y + dy * w * 0.55
    const fw = w * 0.26
    const hook = fl * 0.14 * (i % 2 === 0 ? 1 : 0.6)
    const mx = bx + dx * fl * 0.55 + px * hook
    const my = by + dy * fl * 0.55 + py * hook
    const tx = bx + dx * fl + px * hook * 2.4
    const ty = by + dy * fl + py * hook * 2.4
    ctx.beginPath()
    ctx.moveTo(bx - px * fw, by - py * fw)
    ctx.quadraticCurveTo(mx - px * fw * 0.7, my - py * fw * 0.7, tx, ty)
    ctx.quadraticCurveTo(mx + px * fw * 0.7, my + py * fw * 0.7, bx + px * fw, by + py * fw)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    line(ctx, [[mx, my], [tx, ty]], nail, Math.max(2, fw * 0.8))
  }
}

/** Soft rolling mist: overlapping radial blobs spread along a baseline. */
export function fog(ctx: Ctx, cx: number, y: number, w: number, color: number, alpha: number, seed: number, n = 8): void {
  const r = rng(seed)
  for (let i = 0; i < n; i++) {
    const x = cx + (r() - 0.5) * w
    const yy = y + (r() - 0.5) * 36
    const rx = w * (0.16 + r() * 0.14)
    ctx.save()
    ctx.translate(x, yy)
    ctx.scale(1, 0.36)
    ctx.fillStyle = rad(ctx, 0, 0, 0, rx, [
      [0, css(color, alpha)],
      [1, css(color, 0)],
    ])
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2)
    ctx.restore()
  }
}

/** Glowing jagged crack running down from (x, y). */
export function crack(ctx: Ctx, x: number, y: number, len: number, seed: number, dark: string, hot: number | null, width = 2.5): void {
  const r = rng(seed)
  const pts: Pt[] = [[x, y]]
  let cx = x
  let cy = y
  while (cy < y + len) {
    cx += (r() - 0.5) * len * 0.34
    cy += len * (0.12 + r() * 0.12)
    pts.push([cx, cy])
  }
  if (hot !== null) line(ctx, pts, css(hot, 0.35), width * 3.2)
  line(ctx, pts, hot !== null ? css(lighten(hot, 0.5)) : dark, width)
  const mid = pts[Math.floor(pts.length / 2)]
  line(ctx, [mid, [mid[0] + (r() - 0.3) * len * 0.5, mid[1] + len * 0.22]], hot !== null ? css(hot, 0.9) : dark, width * 0.7)
}

/** A flame tongue with a hot core, rooted at (x, y) and rising h px. */
export function flame(ctx: Ctx, x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  const tongue = (ww: number, hh: number): void => {
    ctx.beginPath()
    ctx.moveTo(x, y - hh)
    ctx.bezierCurveTo(x + ww * 0.9, y - hh * 0.45, x + ww, y - hh * 0.05, x, y)
    ctx.bezierCurveTo(x - ww, y - hh * 0.05, x - ww * 0.9, y - hh * 0.45, x, y - hh)
    ctx.closePath()
  }
  glow(ctx, x, y - h * 0.4, h * 0.9, color, 0.35 * alpha)
  tongue(w, h)
  ctx.fillStyle = lin(ctx, 0, y - h, 0, y, [
    [0, css(color, 0.1 * alpha)],
    [0.5, css(color, 0.85 * alpha)],
    [1, css(lighten(color, 0.35), alpha)],
  ])
  ctx.fill()
  tongue(w * 0.45, h * 0.6)
  ctx.fillStyle = css(lighten(color, 0.8), 0.9 * alpha)
  ctx.fill()
}

/** Bat silhouette with a scalloped wing edge. */
export function bat(ctx: Ctx, x: number, y: number, size: number, color: string): void {
  const half: Pt[] = [[0, -0.1], [0.3, -0.45], [0.55, -0.3], [1.1, -0.5], [0.95, -0.05], [0.8, 0.12], [0.62, 0], [0.44, 0.2], [0.26, 0.04], [0.1, 0.2]]
  ctx.beginPath()
  half.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(x + px * size, y + py * size) : ctx.lineTo(x + px * size, y + py * size)))
  for (let i = half.length - 1; i >= 0; i--) ctx.lineTo(x - half[i][0] * size, y + half[i][1] * size)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ellipse(ctx, x, y, size * 0.1, size * 0.17, color)
}

export interface SkullOpts {
  bone: number
  eye: number
  /** Extra jaw drop in px on top of the pose. */
  jawExtra?: number
  cracked?: boolean
  alpha?: number
}

/**
 * A menacing skull: angular black sockets with burning eyes, a jagged-toothed jaw that drops with the pose.
 * (x, y) is the middle of the cranium, a is half its width.
 */
export function skull(ctx: Ctx, x: number, y: number, a: number, s: PoseSpec, o: SkullOpts): void {
  const jawD = s.jaw * (a / 50) + (o.jawExtra ?? 0)
  ctx.save()
  ctx.globalAlpha = o.alpha ?? 1
  const bone = o.bone
  const my = y + a * 0.78
  // Mouth cavity and lower jaw (behind the cranium).
  polygon(ctx, [[x - a * 0.56, my - 6], [x + a * 0.56, my - 6], [x + a * 0.44, my + jawD + a * 0.3], [x - a * 0.44, my + jawD + a * 0.3]], css(COLORS.BG))
  shape(
    ctx,
    () => {
      ctx.beginPath()
      ctx.moveTo(x - a * 0.6, my + jawD)
      ctx.lineTo(x + a * 0.6, my + jawD)
      ctx.lineTo(x + a * 0.38, my + jawD + a * 0.42)
      ctx.lineTo(x, my + jawD + a * 0.52)
      ctx.lineTo(x - a * 0.38, my + jawD + a * 0.42)
      ctx.closePath()
    },
    css(darken(bone, 0.2)),
    lighten(bone, 0.2),
    0.4,
  )
  for (let i = -3; i <= 3; i++) {
    const tx = x + i * a * 0.15
    const th = a * (0.2 - Math.abs(i) * 0.02)
    polygon(ctx, [[tx - a * 0.07, my + jawD + 1], [tx + a * 0.07, my + jawD + 1], [tx, my + jawD - th]], css(darken(bone, 0.05)))
  }
  // Cranium.
  const cran = (): void => {
    ctx.beginPath()
    ctx.moveTo(x - a * 0.62, my)
    ctx.bezierCurveTo(x - a * 0.78, y + a * 0.5, x - a * 1.02, y + a * 0.3, x - a * 0.98, y - a * 0.1)
    ctx.bezierCurveTo(x - a * 0.95, y - a * 0.75, x - a * 0.5, y - a * 1.08, x, y - a * 1.08)
    ctx.bezierCurveTo(x + a * 0.5, y - a * 1.08, x + a * 0.95, y - a * 0.75, x + a * 0.98, y - a * 0.1)
    ctx.bezierCurveTo(x + a * 1.02, y + a * 0.3, x + a * 0.78, y + a * 0.5, x + a * 0.62, my)
    ctx.closePath()
  }
  shape(
    ctx,
    cran,
    lin(ctx, 0, y - a, 0, y + a, [
      [0, css(lighten(bone, 0.12))],
      [0.6, css(bone)],
      [1, css(darken(bone, 0.5))],
    ]),
    lighten(bone, 0.3),
    0.5,
  )
  // Hollow cheeks.
  for (const sd of [-1, 1]) ellipse(ctx, x + sd * a * 0.66, y + a * 0.5, a * 0.13, a * 0.22, css(COLORS.BG, 0.35), sd * 0.3)
  // Upper teeth.
  for (let i = -3; i <= 3; i++) {
    const tx = x + i * a * 0.15
    polygon(ctx, [[tx - a * 0.07, my - 4], [tx + a * 0.07, my - 4], [tx, my + a * (0.2 - Math.abs(i) * 0.015)]], css(lighten(bone, 0.05)))
  }
  // Nose cavity.
  polygon(ctx, [[x, y + a * 0.28], [x - a * 0.13, y + a * 0.6], [x, y + a * 0.5], [x + a * 0.13, y + a * 0.6]], css(COLORS.BG, 0.92))
  // Sockets.
  for (const sd of [-1, 1]) {
    const ex = x + sd * a * 0.4
    const ey = y + a * 0.14
    polygon(
      ctx,
      [[x + sd * a * 0.1, ey + a * 0.02], [x + sd * a * 0.7, ey - a * 0.22], [x + sd * a * 0.76, ey + a * 0.18], [x + sd * a * 0.5, ey + a * 0.4], [x + sd * a * 0.16, ey + a * 0.28]],
      css(COLORS.BG),
    )
    menaceEye(ctx, ex, ey + a * 0.1, a * 0.12, o.eye, s)
  }
  if (o.cracked) {
    crack(ctx, x + a * 0.2, y - a * 1.05, a * 0.7, 91, css(COLORS.BG, 0.8), s.pose === 'hurt' ? o.eye : null, 2.2)
    if (s.pose === 'hurt') crack(ctx, x - a * 0.5, y - a * 0.6, a * 0.5, 17, css(COLORS.BG, 0.8), o.eye, 2)
  }
  ctx.restore()
}

/**
 * Clears the canvas, paints the character aura, runs `draw` with the pose transform applied,
 * tints the result for hurt or defeated, then fades the bottom edge into the scene.
 */
export function renderPortrait(ctx: Ctx, pose: Pose, auraColor: number, draw: (c: Ctx, s: PoseSpec) => void): void {
  const s = poseSpec(pose)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, PORTRAIT_W, PORTRAIT_H)
  glow(ctx, CX, 250, 250, auraColor, pose === 'defeated' ? 0.12 : 0.38)
  ctx.save()
  ctx.translate(CX, PORTRAIT_H)
  ctx.rotate(s.tilt)
  ctx.scale(s.scale, s.scale)
  ctx.translate(-CX, -PORTRAIT_H + s.dy)
  draw(ctx, s)
  ctx.restore()
  if (s.tint !== null && s.tintAlpha > 0) {
    ctx.globalCompositeOperation = 'source-atop'
    ctx.fillStyle = css(s.tint, s.tintAlpha)
    ctx.fillRect(0, 0, PORTRAIT_W, PORTRAIT_H)
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = lin(ctx, 0, PORTRAIT_H - 90, 0, PORTRAIT_H, [
    [0, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,1)'],
  ])
  ctx.fillRect(0, PORTRAIT_H - 90, PORTRAIT_W, 90)
  ctx.globalCompositeOperation = 'source-over'
}
