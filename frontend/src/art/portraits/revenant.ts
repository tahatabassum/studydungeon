/**
 * Revenant: the ghost of a forgotten question. A translucent hooded wisp with a hollow face, a glowing
 * question-mark rune on its chest, a halo of broken light and a torn page in one hand. Original design.
 */
import { COLORS } from '@/game/colors'
import { REVENANT } from '@/game/revenantLook'
import { CX, claw, css, darken, ellipse, fog, glow, lighten, line, lin, menaceEye, mix, polygon, rad, renderPortrait, rng, shape, tatterPts, type Ctx } from './draw'
import type { PortraitDrawer } from './types'

/** A question mark built from strokes, centred on (x, y), `s` px tall. */
function questionMark(c: Ctx, x: number, y: number, s: number, color: string): void {
  c.save()
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.strokeStyle = color
  c.fillStyle = color
  c.lineWidth = Math.max(2, s * 0.13)
  c.beginPath()
  c.arc(x, y - s * 0.22, s * 0.28, -Math.PI * 0.92, Math.PI * 0.5)
  c.lineTo(x, y + s * 0.12)
  c.stroke()
  c.beginPath()
  c.arc(x, y + s * 0.36, s * 0.07, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

export const drawRevenant: PortraitDrawer = (ctx, pose) => {
  renderPortrait(ctx, pose, REVENANT.CYAN, (c, s) => {
    const cyan = REVENANT.CYAN
    const violet = REVENANT.VIOLET
    const pale = lighten(cyan, 0.55)
    const paper = mix(COLORS.BONE, cyan, 0.3)
    const r = rng(11)
    const dead = s.pose === 'defeated'

    // Drifting motes and tiny question marks (behind the figure).
    for (let i = 0; i < 16; i++) {
      const a = i * 0.9 + 0.4
      const x = CX + Math.cos(a) * (110 + r() * 80)
      const y = 90 + ((i * 53) % 330)
      glow(c, x, y, 12 + r() * 10, i % 2 ? violet : cyan, 0.5)
      if (i % 5 === 0) questionMark(c, x, y, 20, css(pale, 0.3))
    }

    // Broken halo above the hood.
    c.save()
    c.setLineDash([16, 11])
    c.lineWidth = 4
    c.lineCap = 'round'
    c.strokeStyle = css(violet, dead ? 0.2 : 0.6)
    c.beginPath()
    c.ellipse(CX, 58, 82, 20, 0, 0, Math.PI * 2)
    c.stroke()
    c.restore()

    // Wispy arms drawn first so the shroud overlaps their roots.
    const lift = 80 * s.reach
    const hands: Array<[number, number]> = []
    for (const sd of [-1, 1]) {
      const hx = CX + sd * (128 + 14 * s.reach)
      const hy = 318 - lift
      hands.push([hx, hy])
      c.beginPath()
      c.moveTo(CX + sd * 56, 250)
      c.bezierCurveTo(CX + sd * 110, 240, CX + sd * 150, 280, hx, hy)
      c.lineTo(hx - sd * 8, hy + 30)
      c.bezierCurveTo(CX + sd * 140, 330, CX + sd * 90, 340, CX + sd * 50, 320)
      c.closePath()
      c.fillStyle = lin(c, CX, 250, hx, hy, [
        [0, css(cyan, 0.7)],
        [1, css(violet, 0.25)],
      ])
      c.fill()
    }

    // Shroud: tall hooded body whose hem dissolves into tatters. Translucent.
    c.save()
    c.globalAlpha = 0.86
    const body = (): void => {
      c.beginPath()
      c.moveTo(CX - 90, 430)
      c.bezierCurveTo(CX - 106, 340, CX - 96, 250, CX - 86, 180)
      c.bezierCurveTo(CX - 82, 100, CX - 42, 54, CX, 50)
      c.bezierCurveTo(CX + 42, 54, CX + 82, 100, CX + 86, 180)
      c.bezierCurveTo(CX + 96, 250, CX + 106, 340, CX + 90, 430)
      for (const [x, y] of tatterPts(CX + 90, CX - 90, 430, 9, 80, 5)) c.lineTo(x, y)
      c.closePath()
    }
    shape(
      c,
      body,
      lin(c, 0, 50, 0, 500, [
        [0, css(lighten(cyan, 0.45), 0.92)],
        [0.45, css(cyan, 0.62)],
        [1, css(violet, 0.12)],
      ]),
      pale,
      0.18,
    )
    c.save()
    body()
    c.clip()
    // Slow ribbons of light curling through the cloth.
    for (let i = 0; i < 6; i++) {
      const x = CX - 70 + i * 28
      c.beginPath()
      c.moveTo(x, 200)
      c.bezierCurveTo(x + 26, 270, x - 26, 340, x + 16, 440)
      c.lineWidth = 7
      c.lineCap = 'round'
      c.strokeStyle = css(i % 2 ? violet : pale, 0.2)
      c.stroke()
    }
    c.restore()
    c.restore()

    // Hood opening and hollow face.
    ellipse(c, CX, 150, 58, 74, rad(c, CX, 150, 6, 80, [[0, css(COLORS.BG)], [0.7, css(COLORS.INDIGO)], [1, css(REVENANT.DEEP, 0.55)]]))
    for (const sd of [-1, 1]) {
      menaceEye(c, CX + sd * 23, 140, 6.5, mix(cyan, 0xffffff, 0.5), s, 0.22)
      // Tear tracks of light.
      line(c, [[CX + sd * 23, 150], [CX + sd * 26, 190]], css(pale, dead ? 0.1 : 0.32), 3)
    }
    // A wailing mouth that opens with the pose.
    ellipse(c, CX, 196 + s.jaw * 0.3, 13, 7 + s.jaw * 1.1, css(COLORS.BG, 0.9))
    glow(c, CX, 196 + s.jaw * 0.3, 30, violet, dead ? 0.05 : 0.25)

    // The rune on its chest: a ring with a glowing question mark.
    glow(c, CX, 306, 80, violet, (dead ? 0.1 : 0.5) * Math.min(1.4, s.glow))
    c.save()
    c.lineWidth = 3
    c.strokeStyle = css(lighten(violet, 0.3), dead ? 0.25 : 0.85)
    c.beginPath()
    c.arc(CX, 306, 38, 0, Math.PI * 2)
    c.stroke()
    c.setLineDash([5, 8])
    c.strokeStyle = css(cyan, dead ? 0.15 : 0.5)
    c.beginPath()
    c.arc(CX, 306, 48, 0, Math.PI * 2)
    c.stroke()
    c.restore()
    questionMark(c, CX, 306, 52, css(lighten(cyan, 0.7), dead ? 0.3 : 1))

    // Claws, and a torn page held up in the left hand.
    for (const [i, [hx, hy]] of hands.entries()) {
      const sd = i === 0 ? -1 : 1
      glow(c, hx, hy, 46, cyan, 0.35)
      claw(c, hx, hy, sd * 0.4 - Math.PI / 2 + (sd > 0 ? 0.5 : -0.5), 46, 15, css(lighten(cyan, 0.25), 0.9), css(COLORS.BG, 0.6))
    }
    {
      const [px, py] = hands[0]
      c.save()
      c.translate(px - 4, py - 34)
      c.rotate(-0.28)
      polygon(
        c,
        [[-34, -44], [10, -48], [32, -38], [28, -14], [36, 6], [30, 34], [8, 44], [-10, 36], [-30, 46], [-38, 18], [-30, -8], [-38, -28]],
        css(paper, 0.9),
      )
      for (let i = 0; i < 4; i++) line(c, [[-24, -34 + i * 14], [14 - (i % 2) * 8, -34 + i * 14]], css(COLORS.DEEP, 0.4), 2.2)
      questionMark(c, 4, 16, 40, css(REVENANT.DEEP, 0.55))
      c.restore()
    }

    // Cold mist at the base.
    fog(c, CX, 452, 340, cyan, 0.5, 3)
    fog(c, CX, 478, 360, darken(violet, 0.1), 0.4, 6)
  })
}
