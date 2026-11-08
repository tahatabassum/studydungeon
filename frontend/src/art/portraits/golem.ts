/** Clockwork Golem (Gear Golem): a hulking iron-and-brass brute with a furnace for a heart. Original design. */
import { COLORS } from '@/game/colors'
import { CX, crack, css, darken, ellipse, flame, fog, gear, glow, lighten, line, lin, menaceEye, mix, polygon, rad, renderPortrait, roundRect, shape } from './draw'
import type { PortraitDrawer } from './types'

export const drawGolem: PortraitDrawer = (ctx, pose) => {
  renderPortrait(ctx, pose, COLORS.PUMPKIN, (c, s) => {
    const iron = mix(COLORS.BG, COLORS.INK_MUTED, 0.38)
    const brass = mix(COLORS.GOLD, COLORS.BG, 0.5)
    const lens = COLORS.DANGER
    // The golem is wide; shrink it about the bottom centre so its fists stay inside the frame.
    c.translate(CX, 500)
    c.scale(0.8, 0.8)
    c.translate(-CX, -500)
    const rivet = (x: number, y: number): void => {
      ellipse(c, x, y, 4.5, 4.5, css(lighten(brass, 0.3)))
      ellipse(c, x + 1, y + 1.5, 2, 2, css(COLORS.BG, 0.5))
    }
    const plate = (path: () => void, base: number): void =>
      shape(c, path, lin(c, 0, 80, 0, 480, [[0, css(lighten(base, 0.25))], [1, css(darken(base, 0.55))]]), COLORS.PUMPKIN, 0.45)

    // Heat haze behind.
    glow(c, CX, 300, 230, COLORS.PUMPKIN, 0.22)

    // Steam vents on the back with rising puffs.
    for (const sd of [-1, 1]) {
      c.fillStyle = css(darken(iron, 0.3))
      c.fillRect(CX + sd * 96 - 11, 40, 22, 90)
      c.fillStyle = css(brass)
      c.fillRect(CX + sd * 96 - 15, 36, 30, 10)
      fog(c, CX + sd * 96, 24 - s.reach * 6, 90, COLORS.INK_MUTED, 0.5, 30 + sd, 5)
    }

    // Arms (behind torso): thick pistons ending in riveted fists.
    const fistY = 410 - 120 * s.reach
    for (const sd of [-1, 1]) {
      const fx = CX + sd * 140
      c.fillStyle = css(darken(iron, 0.35))
      c.fillRect(CX + sd * 118 - 14, 200, 28, fistY - 200)
      c.fillStyle = css(brass)
      c.fillRect(CX + sd * 118 - 18, 270, 36, 12)
      plate(() => roundRect(c, fx - 44, fistY - 34, 88, 80, 16), iron)
      for (const kx of [-26, -9, 9, 26]) polygon(c, [[fx + kx - 7, fistY - 32], [fx + kx + 7, fistY - 32], [fx + kx, fistY - 52]], css(brass))
      rivet(fx - 30, fistY - 14)
      rivet(fx + 30, fistY - 14)
      rivet(fx - 30, fistY + 30)
      rivet(fx + 30, fistY + 30)
      line(c, [[fx - 36, fistY + 4], [fx + 36, fistY + 4]], css(COLORS.BG, 0.6), 3)
    }

    // Torso.
    plate(() => {
      c.beginPath()
      c.moveTo(CX - 160, 190)
      c.lineTo(CX - 80, 150)
      c.lineTo(CX + 80, 150)
      c.lineTo(CX + 160, 190)
      c.lineTo(CX + 120, 500)
      c.lineTo(CX - 120, 500)
      c.closePath()
    }, iron)

    // Pauldrons with spikes and spinning gears.
    for (const sd of [-1, 1]) {
      plate(() => {
        c.beginPath()
        c.moveTo(CX + sd * 70, 150)
        c.lineTo(CX + sd * 178, 168)
        c.lineTo(CX + sd * 168, 228)
        c.lineTo(CX + sd * 80, 214)
        c.closePath()
      }, mix(iron, brass, 0.3))
      for (let i = 0; i < 3; i++) polygon(c, [[CX + sd * (100 + i * 26), 160 + i * 4], [CX + sd * (118 + i * 26), 164 + i * 4], [CX + sd * (112 + i * 28), 120 - i * 10]], css(brass))
      gear(c, CX + sd * 124, 196, 24, 17, 9, sd * 0.4, css(darken(brass, 0.1)), 6)
      rivet(CX + sd * 160, 182)
    }

    // Furnace chest: cracked grate with fire inside.
    const fx = CX - 56
    const fy = 224
    c.save()
    roundRect(c, fx, fy, 112, 110, 12)
    c.clip()
    c.fillStyle = css(COLORS.BG)
    c.fillRect(fx, fy, 112, 110)
    glow(c, CX, fy + 70, 90, COLORS.PUMPKIN, 0.9)
    const heat = s.pose === 'defeated' ? 0.35 : s.pose === 'taunt' ? 1.35 : 1
    for (let i = 0; i < 4; i++) flame(c, fx + 20 + i * 24, fy + 108, 14, (46 + (i % 2) * 20) * heat, i % 2 ? COLORS.EMBER : COLORS.PUMPKIN)
    c.restore()
    roundRect(c, fx, fy, 112, 110, 12)
    c.lineWidth = 6
    c.strokeStyle = css(brass)
    c.stroke()
    for (let i = 1; i < 5; i++) line(c, [[fx + i * 22.4, fy + 4], [fx + i * 22.4, fy + 106]], css(darken(iron, 0.4)), 5)
    line(c, [[fx + 4, fy + 54], [fx + 108, fy + 54]], css(darken(iron, 0.4)), 5)
    crack(c, fx + 12, fy - 28, 60, 8, css(COLORS.BG), s.pose === 'defeated' ? null : COLORS.PUMPKIN, 3)
    crack(c, fx + 100, fy + 112, 90, 3, css(COLORS.BG), s.pose === 'defeated' ? null : COLORS.PUMPKIN, 3)
    if (s.pose === 'hurt') {
      crack(c, CX - 110, 250, 150, 41, css(COLORS.BG), COLORS.EMBER, 3)
      crack(c, CX + 90, 240, 160, 52, css(COLORS.BG), COLORS.EMBER, 3)
    }
    for (const [x, y] of [[CX - 100, 360], [CX + 100, 360], [CX - 100, 440], [CX + 100, 440], [CX - 60, 180], [CX + 60, 180]] as Array<[number, number]>) rivet(x, y)
    // Brass belt plates with a gear.
    c.fillStyle = css(brass)
    c.fillRect(CX - 118, 396, 236, 18)
    gear(c, CX, 440, 30, 22, 10, 0.3, css(brass), 9)

    // Head: heavy brow slab with one red lens.
    plate(() => {
      c.beginPath()
      c.moveTo(CX - 62, 150)
      c.lineTo(CX - 56, 84)
      c.lineTo(CX + 56, 84)
      c.lineTo(CX + 62, 150)
      c.closePath()
    }, iron)
    for (const sd of [-1, 1]) polygon(c, [[CX + sd * 40, 88], [CX + sd * 66, 88], [CX + sd * 58, 40]], css(brass))
    polygon(c, [[CX - 54, 100], [CX + 54, 100], [CX + 46, 128], [CX - 46, 128]], css(COLORS.BG))
    menaceEye(c, CX + 0.01, 114, 15, lens, s, 0)
    line(c, [[CX - 50, 96], [CX + 50, 96]], css(brass), 5)
    // Grille mouth.
    const jaw = s.jaw * 0.5
    c.fillStyle = css(COLORS.BG)
    c.fillRect(CX - 30, 134, 60, 10 + jaw)
    for (let i = -2; i <= 2; i++) line(c, [[CX + i * 12, 134], [CX + i * 12, 144 + jaw]], css(lighten(brass, 0.2)), 3)
    rivet(CX - 52, 94)
    rivet(CX + 52, 94)

    ellipse(c, CX, 500, 160, 22, rad(c, CX, 500, 0, 160, [[0, css(COLORS.PUMPKIN, 0.3)], [1, css(COLORS.PUMPKIN, 0)]]))
    fog(c, CX, 475, 380, COLORS.INK_MUTED, 0.3, 14)
  })
}
