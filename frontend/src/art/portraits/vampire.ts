/** Vampire (Memory Eater): gaunt lord in a bat-wing cape with a blood-red moon behind. Original design. */
import { COLORS } from '@/game/colors'
import { CX, bat, claw, css, darken, ellipse, fog, glow, lighten, line, lin, menaceEye, mix, polygon, rad, renderPortrait, shape } from './draw'
import type { PortraitDrawer } from './types'

export const drawVampire: PortraitDrawer = (ctx, pose) => {
  renderPortrait(ctx, pose, COLORS.BLOOD_RED, (c, s) => {
    const skin = mix(COLORS.BONE, COLORS.MAGIC, 0.22)
    const black = mix(COLORS.BG, COLORS.INDIGO, 0.5)
    const lining = mix(COLORS.BLOOD_RED, COLORS.BG, 0.35)
    const spread = 0.5 + 0.5 * s.reach

    // Blood-red moon behind the head and bat silhouettes.
    ellipse(c, CX, 150, 120, 120, rad(c, CX, 150, 20, 120, [[0, css(COLORS.BLOOD_RED, 0.55)], [1, css(COLORS.BLOOD_RED, 0)]]))
    const bats: Array<[number, number, number]> = [[40, 70, 34], [320, 60, 30], [70, 190, 22], [300, 200, 26], [180, 30, 18]]
    for (const [x, y, z] of bats) bat(c, x, y + (s.pose === 'taunt' ? -8 : 0), z, css(COLORS.BG, 0.9))

    // Wing-cape: scalloped spread with finger ribs, crimson lining.
    for (const sd of [-1, 1]) {
      const tipX = CX + sd * (140 + 32 * spread)
      const tipY = 190 - 100 * spread
      const wing = (): void => {
        c.beginPath()
        c.moveTo(CX + sd * 50, 230)
        c.lineTo(tipX, tipY)
        const lowY = 440
        const pts: Array<[number, number]> = [
          [tipX - sd * 10, tipY + 110],
          [CX + sd * 150, tipY + 190],
          [CX + sd * 150, tipY + 260],
          [CX + sd * 100, 380],
          [CX + sd * 70, lowY],
        ]
        let px = tipX
        let py = tipY
        for (const [x, y] of pts) {
          c.quadraticCurveTo((px + x) / 2 - sd * 24, (py + y) / 2 + 22, x, y)
          px = x
          py = y
        }
        c.lineTo(CX + sd * 40, 500)
        c.closePath()
      }
      shape(
        c,
        wing,
        lin(c, CX, 100, CX + sd * 200, 450, [
          [0, css(lighten(lining, 0.1))],
          [1, css(darken(lining, 0.6))],
        ]),
        COLORS.BLOOD_RED,
        0.45,
      )
      for (const [rx, ry] of [[CX + sd * 150, tipY + 190], [CX + sd * 110, 370]] as Array<[number, number]>) {
        line(c, [[CX + sd * 50, 230], [(CX + sd * 50 + rx) / 2, (230 + ry) / 2 - 20], [rx, ry]], css(black), 5)
      }
      line(c, [[CX + sd * 50, 230], [tipX, tipY]], css(black), 8)
    }

    // Coat and pointed high collar.
    shape(
      c,
      () => {
        c.beginPath()
        c.moveTo(CX - 110, 500)
        c.lineTo(CX - 100, 300)
        c.lineTo(CX - 52, 250)
        c.lineTo(CX + 52, 250)
        c.lineTo(CX + 100, 300)
        c.lineTo(CX + 110, 500)
        c.closePath()
      },
      css(black),
      COLORS.MAGIC,
      0.4,
    )
    polygon(c, [[CX - 18, 270], [CX + 18, 270], [CX + 6, 440], [CX - 6, 440]], css(lining))
    for (const sd of [-1, 1]) {
      polygon(c, [[CX + sd * 30, 250], [CX + sd * 100, 140], [CX + sd * 92, 300], [CX + sd * 46, 300]], css(black))
      polygon(c, [[CX + sd * 36, 255], [CX + sd * 92, 168], [CX + sd * 86, 288], [CX + sd * 48, 292]], css(lining))
    }

    // Gaunt head: pointed ears, hollow cheeks, sharp chin, slicked widow's-peak hair.
    for (const sd of [-1, 1]) polygon(c, [[CX + sd * 56, 170], [CX + sd * 96, 100], [CX + sd * 62, 206]], css(skin))
    shape(
      c,
      () => {
        c.beginPath()
        c.moveTo(CX - 62, 120)
        c.bezierCurveTo(CX - 66, 190, CX - 58, 214, CX - 34, 240)
        c.lineTo(CX, 276 + s.jaw * 0.6)
        c.lineTo(CX + 34, 240)
        c.bezierCurveTo(CX + 58, 214, CX + 66, 190, CX + 62, 120)
        c.bezierCurveTo(CX + 40, 70, CX - 40, 70, CX - 62, 120)
        c.closePath()
      },
      lin(c, 0, 90, 0, 280, [[0, css(lighten(skin, 0.1))], [1, css(darken(skin, 0.45))]]),
      lighten(skin, 0.2),
      0.45,
    )
    c.beginPath()
    c.moveTo(CX - 66, 140)
    c.bezierCurveTo(CX - 76, 70, CX - 30, 52, CX, 54)
    c.bezierCurveTo(CX + 30, 52, CX + 76, 70, CX + 66, 140)
    c.lineTo(CX + 58, 118)
    c.lineTo(CX + 14, 112)
    c.lineTo(CX, 140)
    c.lineTo(CX - 14, 112)
    c.lineTo(CX - 58, 118)
    c.closePath()
    c.fillStyle = css(black)
    c.fill()
    for (const sd of [-1, 1]) line(c, [[CX + sd * 12, 70], [CX + sd * 40, 90], [CX + sd * 58, 120]], css(COLORS.MAGIC, 0.35), 2)
    // Cheekbone hollows and brow shadow.
    for (const sd of [-1, 1]) {
      polygon(c, [[CX + sd * 62, 178], [CX + sd * 24, 214], [CX + sd * 42, 190], [CX + sd * 58, 166]], css(COLORS.BG, 0.45))
      polygon(c, [[CX + sd * 6, 150], [CX + sd * 58, 138], [CX + sd * 52, 160], [CX + sd * 8, 166]], css(COLORS.BG, 0.65))
      menaceEye(c, CX + sd * 30, 160, 8, COLORS.DANGER, s, 0.4)
    }
    // Nose.
    polygon(c, [[CX, 164], [CX - 9, 206], [CX, 202], [CX + 9, 206]], css(darken(skin, 0.3), 0.8))
    // Mouth and long fangs.
    const my = 228
    const open = s.jaw * 0.8
    polygon(c, [[CX - 30, my], [CX, my + 6 + open], [CX + 30, my], [CX, my - 4]], css(COLORS.BG))
    polygon(c, [[CX - 24, my + 2], [CX - 16, my + 4], [CX - 20, my + 30 + open * 0.4]], css(COLORS.BONE))
    polygon(c, [[CX + 24, my + 2], [CX + 16, my + 4], [CX + 20, my + 30 + open * 0.4]], css(COLORS.BONE))
    glow(c, CX, 170, 110, COLORS.DANGER, 0.12)

    // Clawed hands clutching the cape.
    const hy = 360 - 90 * s.reach
    for (const sd of [-1, 1]) {
      claw(c, CX + sd * 96, hy, sd > 0 ? -0.9 : -Math.PI + 0.9, 54, 16, css(skin), css(COLORS.BG, 0.85))
    }
    fog(c, CX, 470, 380, COLORS.BLOOD_RED, 0.3, 4)
  })
}
