/** Exam Warden (boss): a towering candle-crowned lich judge with a quill-scythe and purple fire. Original design. */
import { COLORS } from '@/game/colors'
import { CX, claw, crack, css, darken, ellipse, flame, fog, glow, lighten, line, lin, menaceEye, mix, polygon, rad, renderPortrait, rng, shape, skull, tatterPts } from './draw'
import type { PortraitDrawer } from './types'

export const drawWarden: PortraitDrawer = (ctx, pose) => {
  renderPortrait(ctx, pose, COLORS.MAGENTA, (c, s) => {
    const robe = mix(COLORS.INDIGO, COLORS.BG, 0.4)
    const bone = mix(COLORS.BONE, COLORS.MAGIC, 0.35)
    const r = rng(33)
    const fury = s.pose === 'taunt' ? 1.4 : s.pose === 'defeated' ? 0.25 : 1

    // Purple fire aura rising behind the figure.
    glow(c, CX, 200, 240, COLORS.MAGIC, 0.4 * fury)
    for (let i = 0; i < 13; i++) {
      const x = 20 + i * 28 + r() * 10
      const h = (110 + r() * 150 + (i % 3) * 30) * fury
      flame(c, x, 470, 22 + r() * 12, h, i % 2 ? COLORS.MAGIC : COLORS.MAGENTA, 0.55)
    }

    for (const [x, y] of [[24, 380], [58, 330], [336, 380], [300, 320]] as Array<[number, number]>) {
      flame(c, x, y, 24, (120 + r() * 60) * fury, COLORS.MAGIC, 0.7)
    }

    // Floating runes.
    const runes: Array<[number, number]> = [[34, 120], [320, 150], [48, 290], [316, 330], [300, 40], [70, 40]]
    runes.forEach(([x, y], i) => {
      const drift = s.pose === 'defeated' ? 0 : Math.sin(i * 2) * 6
      const pts: Array<[number, number]> = [[x - 8, y - 12 + drift], [x + 6, y - 4 + drift], [x - 4, y + 4 + drift], [x + 8, y + 14 + drift]]
      glow(c, x, y + drift, 26, COLORS.MAGENTA, 0.5 * fury)
      line(c, pts, css(lighten(COLORS.MAGENTA, 0.5), 0.95 * Math.min(1, fury + 0.2)), 3)
      line(c, [[x - 10, y + drift], [x + 10, y - 8 + drift]], css(lighten(COLORS.MAGENTA, 0.5), 0.8), 2)
    })

    // Quill-scythe: staff and a feather blade.
    const sx = CX + 128
    line(c, [[sx, 500], [sx - 10, 60]], css(darken(COLORS.GOLD, 0.45)), 8)
    line(c, [[sx, 500], [sx - 10, 60]], css(COLORS.GOLD, 0.5), 2)
    c.beginPath()
    c.moveTo(sx - 12, 56)
    c.bezierCurveTo(sx + 30, 24, sx + 40, 80, sx + 30, 130)
    c.bezierCurveTo(sx + 32, 80, sx + 4, 56, sx - 12, 56)
    c.closePath()
    c.fillStyle = lin(c, sx - 10, 40, sx + 40, 130, [[0, css(lighten(COLORS.MAGENTA, 0.6))], [1, css(COLORS.MAGENTA)]])
    c.fill()
    glow(c, sx + 18, 80, 60, COLORS.MAGENTA, 0.5 * fury)
    for (let i = 0; i < 5; i++) line(c, [[sx + 8 + i * 5, 66 + i * 12], [sx + 26 + i * 2, 70 + i * 14]], css(COLORS.BONE, 0.8), 2)

    // Robe: a huge tapering shroud with a tattered hem.
    const hem = tatterPts(CX + 200, CX - 200, 484, 14, -30, 9)
    const body = (): void => {
      c.beginPath()
      c.moveTo(CX - 200, 500)
      c.bezierCurveTo(CX - 180, 400, CX - 160, 300, CX - 120, 236)
      c.lineTo(CX - 60, 150)
      c.lineTo(CX + 60, 150)
      c.lineTo(CX + 120, 236)
      c.bezierCurveTo(CX + 160, 300, CX + 180, 400, CX + 200, 500)
      hem.forEach(([x, y]) => c.lineTo(x, y))
      c.closePath()
    }
    shape(c, body, lin(c, 0, 150, 0, 480, [[0, css(lighten(robe, 0.2))], [1, css(darken(robe, 0.65))]]), COLORS.MAGIC, 0.5)
    c.save()
    body()
    c.clip()
    for (let i = -4; i <= 4; i++) line(c, [[CX + i * 18, 260], [CX + i * 40, 490]], css(COLORS.BG, 0.3), 5)
    // Gold trim and glowing sigils down the front.
    line(c, [[CX - 18, 240], [CX - 26, 490]], css(COLORS.GOLD, 0.8), 4)
    line(c, [[CX + 18, 240], [CX + 26, 490]], css(COLORS.GOLD, 0.8), 4)
    for (let i = 0; i < 5; i++) {
      const y = 290 + i * 38
      line(c, [[CX - 8, y], [CX + 8, y + 10], [CX - 6, y + 20]], css(lighten(COLORS.MAGENTA, 0.4), 0.85), 2.5)
    }
    c.restore()

    // Hood and shadowed skull face.
    c.beginPath()
    c.moveTo(CX - 100, 210)
    c.bezierCurveTo(CX - 110, 100, CX - 60, 44, CX, 40)
    c.bezierCurveTo(CX + 60, 44, CX + 110, 100, CX + 100, 210)
    c.lineTo(CX + 70, 164)
    c.lineTo(CX - 70, 164)
    c.closePath()
    c.fillStyle = lin(c, 0, 40, 0, 210, [[0, css(lighten(robe, 0.15))], [1, css(darken(robe, 0.4))]])
    c.fill()
    ellipse(c, CX, 148, 76, 90, rad(c, CX, 148, 6, 92, [[0, css(COLORS.BG)], [0.75, css(COLORS.INDIGO)], [1, css(robe, 0)]]))
    skull(c, CX, 144, 48, s, { bone: darken(bone, 0.45), eye: COLORS.MAGENTA, jawExtra: 4 })
    // Third eye on the brow and two small watchers on the hood.
    menaceEye(c, CX + 0.01, 98, 8, lighten(COLORS.MAGENTA, 0.3), s, 0)
    for (const sd of [-1, 1]) menaceEye(c, CX + sd * 74, 150, 4, COLORS.MAGENTA, s, 0.2)

    // Crown of spikes and candles.
    const crownY = 60
    polygon(c, [[CX - 66, crownY + 14], [CX + 66, crownY + 14], [CX + 56, crownY + 30], [CX - 56, crownY + 30]], css(darken(COLORS.GOLD, 0.3)))
    for (let i = -3; i <= 3; i++) {
      const x = CX + i * 20
      const h = i % 2 === 0 ? 40 : 24
      polygon(c, [[x - 7, crownY + 16], [x + 7, crownY + 16], [x, crownY + 16 - h]], css(i % 2 === 0 ? COLORS.GOLD : darken(COLORS.GOLD, 0.25)))
      if (i % 2 === 0) {
        c.fillStyle = css(COLORS.BONE)
        c.fillRect(x - 3, crownY - 4 - h * 0.1, 6, 12)
        flame(c, x, crownY - 6 - h * 0.1, 7, 20 * fury, COLORS.PUMPKIN)
      }
    }

    // Bony claws: one on the staff, one raising the exam scroll.
    const lift = 70 * s.reach
    claw(c, sx - 4, 330 - lift * 0.4, -Math.PI / 2 + 0.15, 40, 15, css(bone), css(COLORS.BG, 0.8))
    const scx = CX - 136
    const scy = 330 - lift
    c.fillStyle = css(robe)
    c.fillRect(scx - 6, scy + 14, 14, 40)
    ellipse(c, scx + 2, scy + 20, 20, 7, css(darken(COLORS.BONE, 0.2)))
    c.fillStyle = lin(c, scx - 30, 0, scx + 34, 0, [[0, css(darken(COLORS.BONE, 0.25))], [0.5, css(COLORS.BONE)], [1, css(darken(COLORS.BONE, 0.3))]])
    c.fillRect(scx - 30, scy + 20, 64, 100)
    ellipse(c, scx + 2, scy + 120, 33, 7, css(darken(COLORS.BONE, 0.3)))
    for (let i = 0; i < 4; i++) line(c, [[scx - 18, scy + 40 + i * 20], [scx + 20, scy + 40 + i * 20]], css(COLORS.MAGENTA, 0.8), 3)
    line(c, [[scx - 14, scy + 100], [scx, scy + 82], [scx + 14, scy + 100]], css(COLORS.BLOOD_RED), 4)
    claw(c, scx + 2, scy + 10, -Math.PI / 2 - 0.2, 40, 15, css(bone), css(COLORS.BG, 0.8))

    if (s.pose === 'hurt') {
      crack(c, CX - 20, 40, 130, 14, css(COLORS.BG), COLORS.MAGENTA, 3)
      crack(c, CX + 40, 250, 170, 15, css(COLORS.BG), COLORS.MAGENTA, 3)
    }
    fog(c, CX, 470, 400, COLORS.MAGIC, 0.5, 9)
  })
}
