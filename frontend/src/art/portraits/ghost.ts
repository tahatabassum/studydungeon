/** Paper Wraith: a tattered spectral shroud of old exam paper with a hollow skull face. Original design. */
import { COLORS } from '@/game/colors'
import { CX, claw, css, darken, ellipse, fog, glow, lighten, line, lin, menaceEye, mix, polygon, rad, renderPortrait, rng, shape, skull } from './draw'
import type { PortraitDrawer } from './types'

export const drawGhost: PortraitDrawer = (ctx, pose) => {
  renderPortrait(ctx, pose, COLORS.GHOST, (c, s) => {
    const paper = mix(COLORS.BONE, COLORS.GHOST, 0.28)
    const cold = mix(COLORS.GHOST, COLORS.BG, 0.45)
    const r = rng(7)
    const rise = 1 + s.reach * 0.25

    // Swirling exam-paper scraps (behind the shroud).
    for (let i = 0; i < 9; i++) {
      const a = i * 0.8 + 0.3
      const x = CX + Math.cos(a) * (120 + r() * 70)
      const y = 120 + ((i * 47) % 280)
      c.save()
      c.translate(x, y)
      c.rotate(a * 1.7)
      c.fillStyle = css(paper, 0.5 + r() * 0.35)
      c.beginPath()
      c.moveTo(-15, -10)
      c.lineTo(5, -13)
      c.lineTo(16, -3)
      c.lineTo(11, 11)
      c.lineTo(-4, 8)
      c.lineTo(-16, 12)
      c.closePath()
      c.fill()
      line(c, [[-10, -4], [8, -5]], css(COLORS.DEEP, 0.55), 1.6)
      line(c, [[-10, 2], [4, 3]], css(COLORS.DEEP, 0.55), 1.6)
      c.restore()
    }

    // Long torn paper strips streaming upward off the shroud.
    for (const sd of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const by = 430 - i * 38
        const bx = CX + sd * (110 + i * 9)
        const tx = bx + sd * (28 + r() * 36)
        const ty = by - (80 + r() * 60) * rise
        c.beginPath()
        c.moveTo(bx, by)
        c.bezierCurveTo(bx + sd * 30, by - 30, tx - sd * 24, ty + 40, tx, ty)
        c.bezierCurveTo(tx - sd * 14, ty + 50, bx + sd * 6, by - 20, bx - sd * 14, by + 6)
        c.closePath()
        c.fillStyle = lin(c, bx, by, tx, ty, [
          [0, css(paper, 0.8)],
          [1, css(cold, 0)],
        ])
        c.fill()
      }
    }

    // Shroud: tall hooded body, tattered hem.
    const body = (): void => {
      c.beginPath()
      c.moveTo(CX - 168, 500)
      c.bezierCurveTo(CX - 150, 380, CX - 120, 300, CX - 98, 220)
      c.bezierCurveTo(CX - 92, 120, CX - 56, 52, CX, 36)
      c.bezierCurveTo(CX + 56, 52, CX + 92, 120, CX + 98, 220)
      c.bezierCurveTo(CX + 120, 300, CX + 150, 380, CX + 168, 500)
      c.closePath()
    }
    shape(
      c,
      body,
      lin(c, 0, 36, 0, 480, [
        [0, css(lighten(paper, 0.1), 0.95)],
        [0.45, css(mix(paper, cold, 0.4), 0.9)],
        [1, css(cold, 0.55)],
      ]),
      COLORS.GHOST,
      0.45,
    )
    c.save()
    body()
    c.clip()
    // Vertical folds and faded handwriting.
    for (let i = -3; i <= 3; i++) {
      line(c, [[CX + i * 30, 240], [CX + i * 44, 480]], css(COLORS.BG, 0.18), 5)
    }
    for (let i = 0; i < 6; i++) {
      line(c, [[CX - 70 + (i % 2) * 14, 330 + i * 22], [CX + 40 - (i % 3) * 18, 328 + i * 22]], css(COLORS.DEEP, 0.3), 2.5)
    }
    // A red F scrawled on the chest.
    line(c, [[CX + 28, 300], [CX + 28, 340]], css(COLORS.BLOOD_RED, 0.55), 4)
    line(c, [[CX + 28, 300], [CX + 52, 300]], css(COLORS.BLOOD_RED, 0.55), 4)
    line(c, [[CX + 28, 318], [CX + 46, 318]], css(COLORS.BLOOD_RED, 0.55), 4)
    c.restore()

    // Dark hood opening with the hollow face.
    ellipse(c, CX, 150, 74, 92, rad(c, CX, 150, 8, 96, [[0, css(COLORS.BG)], [0.7, css(COLORS.INDIGO)], [1, css(cold, 0.5)]]))
    skull(c, CX, 138, 50, s, { bone: mix(COLORS.BONE, COLORS.GHOST, 0.45), eye: COLORS.GHOST, jawExtra: 14, alpha: 0.78 })
    // Pinpoint cold stare inside each socket.
    for (const sd of [-1, 1]) {
      menaceEye(c, CX + sd * 20, 150, 4, mix(COLORS.GHOST, 0xffffff, 0.35), s, 0.3)
    }
    // Gaping mouth drips shadow down the chest.
    polygon(c, [[CX - 16, 186 + s.jaw], [CX + 16, 186 + s.jaw], [CX + 6, 250 + s.jaw * 2], [CX - 6, 250 + s.jaw * 2]], css(COLORS.BG, 0.6))

    // Clawed, wispy hands reaching forward.
    const lift = 70 * s.reach
    for (const sd of [-1, 1]) {
      const hx = CX + sd * (118 + 10 * s.reach)
      const hy = 330 - lift
      c.beginPath()
      c.moveTo(CX + sd * 70, 300)
      c.quadraticCurveTo(CX + sd * 120, 330, hx, hy + 6)
      c.lineTo(hx - sd * 14, hy + 22)
      c.quadraticCurveTo(CX + sd * 100, 360, CX + sd * 56, 360)
      c.closePath()
      c.fillStyle = css(paper, 0.7)
      c.fill()
      glow(c, hx, hy, 46, COLORS.GHOST, 0.35)
      claw(c, hx, hy, sd * 0.4 - Math.PI / 2 + (sd > 0 ? 0.5 : -0.5) + (sd > 0 ? 0 : 0), 52, 17, css(lighten(paper, 0.15), 0.92), css(COLORS.BG, 0.8))
    }

    // Cold mist pooling at the base.
    fog(c, CX, 452, 340, COLORS.GHOST, 0.5, 3)
    fog(c, CX, 478, 360, darken(COLORS.GHOST, 0.1), 0.45, 5)
  })
}
