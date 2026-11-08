/** Witch (Toxic Slime): a hunched crone with a bubbling toxic potion, a crow and a pale moon. Original design. */
import { COLORS } from '@/game/colors'
import { CX, claw, crack, css, darken, ellipse, fog, glow, lighten, line, lin, menaceEye, mix, polygon, rad, renderPortrait, rng, shape } from './draw'
import type { PortraitDrawer } from './types'

export const drawWitch: PortraitDrawer = (ctx, pose) => {
  renderPortrait(ctx, pose, COLORS.TOXIC, (c, s) => {
    const skin = mix(COLORS.TOXIC, COLORS.BONE, 0.6)
    const robe = mix(COLORS.WITCH, COLORS.BG, 0.6)
    const hat = mix(COLORS.WITCH, COLORS.BG, 0.72)
    const r = rng(21)

    // Pale moon behind the hat.
    glow(c, 262, 120, 130, COLORS.BONE, 0.2)
    ellipse(c, 262, 120, 62, 62, rad(c, 250, 108, 4, 66, [[0, css(COLORS.BONE)], [1, css(darken(COLORS.BONE, 0.35))]]))
    ellipse(c, 240, 130, 14, 10, css(darken(COLORS.BONE, 0.3), 0.5))

    // Wild hair streaming behind the shoulders.
    for (let i = 0; i < 12; i++) {
      const sd = i % 2 === 0 ? -1 : 1
      const sx = CX + sd * (42 + r() * 20)
      const ex = CX + sd * (95 + r() * 70)
      line(
        c,
        [[sx, 235], [sx + sd * 30, 290 + r() * 30], [ex, 340 + r() * 90]],
        css(i % 3 === 0 ? COLORS.INK_MUTED : darken(COLORS.INK_MUTED, 0.5), 0.9),
        3 + r() * 4,
      )
    }

    // Hunched robe.
    shape(
      c,
      () => {
        c.beginPath()
        c.moveTo(CX - 200, 500)
        c.bezierCurveTo(CX - 170, 400, CX - 150, 330, CX - 70, 296)
        c.lineTo(CX + 70, 296)
        c.bezierCurveTo(CX + 150, 330, CX + 170, 400, CX + 200, 500)
        c.closePath()
      },
      lin(c, 0, 290, 0, 490, [[0, css(lighten(robe, 0.15))], [1, css(darken(robe, 0.6))]]),
      COLORS.MAGIC,
      0.4,
    )
    for (let i = -3; i <= 3; i++) line(c, [[CX + i * 24, 330], [CX + i * 46, 490]], css(COLORS.BG, 0.3), 4)
    polygon(c, [[CX - 40, 300], [CX + 40, 300], [CX, 400]], css(COLORS.BG, 0.65))

    // Crow on the shoulder.
    ellipse(c, CX + 112, 312, 20, 14, css(COLORS.BG), -0.4)
    ellipse(c, CX + 126, 296, 10, 9, css(COLORS.BG))
    polygon(c, [[CX + 133, 292], [CX + 152, 298], [CX + 133, 301]], css(darken(COLORS.GOLD, 0.2)))
    glow(c, CX + 129, 294, 12, COLORS.TOXIC, 0.8)
    polygon(c, [[CX + 96, 322], [CX + 74, 342], [CX + 100, 332]], css(COLORS.BG))

    // Face: long, sharp, with a hooked nose and pointed chin.
    shape(
      c,
      () => {
        c.beginPath()
        c.moveTo(CX - 54, 214)
        c.bezierCurveTo(CX - 60, 260, CX - 44, 292, CX - 18, 318 + s.jaw * 0.4)
        c.lineTo(CX + 4, 330 + s.jaw * 0.6)
        c.bezierCurveTo(CX + 14, 306, CX + 52, 282, CX + 54, 214)
        c.closePath()
      },
      lin(c, 0, 200, 0, 330, [[0, css(lighten(skin, 0.1))], [1, css(darken(skin, 0.5))]]),
      lighten(skin, 0.25),
      0.45,
    )
    polygon(c, [[CX + 2, 238], [CX + 30, 290], [CX + 14, 296], [CX - 2, 276], [CX - 8, 262]], css(darken(skin, 0.15)))
    ellipse(c, CX + 24, 280, 4, 4, css(COLORS.DEEP, 0.9))
    // Eyes under heavy brows.
    for (const sd of [-1, 1]) {
      polygon(c, [[CX + sd * 4, 226], [CX + sd * 50, 218], [CX + sd * 44, 238], [CX + sd * 8, 242]], css(COLORS.BG, 0.75))
      menaceEye(c, CX + sd * 26, 236, 8, COLORS.TOXIC, s, 0.45)
    }
    // Wicked grin with broken teeth.
    const my = 296
    const open = s.jaw * 0.7
    c.beginPath()
    c.moveTo(CX - 30, my - 10)
    c.quadraticCurveTo(CX, my + 14 + open, CX + 34, my - 14)
    c.quadraticCurveTo(CX + 4, my + 2, CX - 30, my - 10)
    c.closePath()
    c.fillStyle = css(COLORS.BG)
    c.fill()
    for (const [tx, h] of [[-22, 9], [-10, 13], [4, 8], [16, 12], [26, 7]] as Array<[number, number]>) {
      polygon(c, [[CX + tx - 4, my - 6 + tx * -0.02], [CX + tx + 4, my - 8], [CX + tx, my - 6 + h + open * 0.3]], css(lighten(COLORS.EMBER, 0.55)))
    }

    // Tall crooked hat with buckle band.
    const brimY = 214
    shape(
      c,
      () => {
        c.beginPath()
        c.moveTo(CX - 120, brimY + 14)
        c.quadraticCurveTo(CX - 40, brimY - 12, CX + 118, brimY + 10)
        c.quadraticCurveTo(CX + 40, brimY + 30, CX - 120, brimY + 14)
        c.closePath()
        c.moveTo(CX - 62, brimY + 4)
        c.bezierCurveTo(CX - 54, 130, CX - 20, 80, CX - 8, 56)
        c.quadraticCurveTo(CX + 4, 28, CX + 52, 14)
        c.quadraticCurveTo(CX + 22, 52, CX + 22, 86)
        c.bezierCurveTo(CX + 30, 130, CX + 52, 170, CX + 62, brimY + 6)
        c.closePath()
      },
      lin(c, 0, 20, 0, 230, [[0, css(lighten(hat, 0.25))], [1, css(darken(hat, 0.5))]]),
      COLORS.MAGIC,
      0.4,
    )
    polygon(c, [[CX - 56, 190], [CX + 58, 190], [CX + 62, 208], [CX - 60, 208]], css(darken(hat, 0.4)))
    c.strokeStyle = css(COLORS.GOLD)
    c.lineWidth = 4
    c.strokeRect(CX - 10, 188, 22, 22)

    // Bony hand with a bubbling toxic flask.
    const bx = CX - 112
    const by = 392 - 100 * s.reach
    fog(c, bx, by - 70, 120, COLORS.TOXIC, 0.45, 12, 6)
    glow(c, bx, by, 100, COLORS.TOXIC, 0.55)
    polygon(c, [[bx - 11, by - 56], [bx + 11, by - 56], [bx + 9, by - 28], [bx - 9, by - 28]], css(mix(COLORS.BONE, COLORS.TOXIC, 0.3), 0.9))
    c.fillStyle = css(COLORS.GOLD, 0.8)
    c.fillRect(bx - 9, by - 66, 18, 12)
    ellipse(c, bx, by, 38, 36, rad(c, bx - 8, by - 10, 4, 42, [[0, css(lighten(COLORS.TOXIC, 0.5))], [0.6, css(COLORS.TOXIC)], [1, css(darken(COLORS.TOXIC, 0.55))]]))
    ctx.save()
    for (const [ox, oy, rr] of [[-12, -6, 6], [8, 10, 5], [14, -14, 4], [-4, 14, 3]] as Array<[number, number, number]>) {
      c.beginPath()
      c.arc(bx + ox, by + oy, rr, 0, Math.PI * 2)
      c.lineWidth = 2
      c.strokeStyle = css(lighten(COLORS.TOXIC, 0.7), 0.85)
      c.stroke()
    }
    ctx.restore()
    claw(c, bx + 4, by - 36, 0.15, 44, 13, css(skin), css(COLORS.BG, 0.85))
    // Other hand, reaching.
    c.beginPath()
    c.moveTo(CX + 90, 330)
    c.quadraticCurveTo(CX + 150, 350, CX + 146, 392 - 40 * s.reach)
    c.lineTo(CX + 128, 392 - 40 * s.reach)
    c.quadraticCurveTo(CX + 120, 350, CX + 70, 350)
    c.closePath()
    c.fillStyle = css(darken(robe, 0.2))
    c.fill()
    claw(c, CX + 140, 384 - 40 * s.reach, -0.9, 56, 14, css(skin), css(COLORS.BG, 0.85))

    if (s.pose === 'hurt') crack(c, CX + 20, 214, 90, 4, css(COLORS.BG), COLORS.TOXIC, 2.5)
    fog(c, CX, 470, 380, COLORS.TOXIC, 0.35, 6)
  })
}
