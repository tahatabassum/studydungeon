/** Skeleton: a cracked-skull reaper in a tattered hood, with a rusted chain and ember lantern. Original design. */
import { COLORS } from '@/game/colors'
import { CX, claw, crack, css, darken, ellipse, fog, glow, lighten, line, lin, mix, polygon, rad, renderPortrait, shape, skull, tatterPts } from './draw'
import type { PortraitDrawer } from './types'

export const drawSkeleton: PortraitDrawer = (ctx, pose) => {
  renderPortrait(ctx, pose, COLORS.PUMPKIN, (c, s) => {
    const bone = mix(COLORS.BONE, COLORS.EMBER, 0.12)
    const cloak = mix(COLORS.INDIGO, COLORS.DEEP, 0.5)
    const rust = mix(COLORS.PUMPKIN, COLORS.BG, 0.55)
    const lx = CX + 112 // lantern hand x
    const swing = s.pose === 'taunt' ? -30 : 0

    // Hood and cloak: a hunched triangle with a tattered hem.
    const hem = tatterPts(CX + 190, CX - 190, 482, 14, -34, 11)
    const body = (): void => {
      c.beginPath()
      c.moveTo(CX - 190, 500)
      c.lineTo(CX - 120, 300)
      c.bezierCurveTo(CX - 118, 230, CX - 98, 130, CX - 66, 80)
      c.lineTo(CX - 20, 28)
      c.lineTo(CX + 22, 42)
      c.bezierCurveTo(CX + 80, 90, CX + 118, 200, CX + 122, 300)
      c.lineTo(CX + 190, 500)
      hem.forEach(([x, y]) => c.lineTo(x, y))
      c.closePath()
    }
    shape(
      c,
      body,
      lin(c, 0, 30, 0, 480, [
        [0, css(lighten(cloak, 0.18))],
        [0.5, css(cloak)],
        [1, css(darken(cloak, 0.6))],
      ]),
      COLORS.MAGIC,
      0.45,
    )
    c.save()
    body()
    c.clip()
    for (let i = -4; i <= 4; i++) line(c, [[CX + i * 20, 300], [CX + i * 40, 490]], css(COLORS.BG, 0.3), 5)
    // Warm under-lighting from the lantern.
    glow(c, lx, 400, 220, COLORS.PUMPKIN, 0.3)
    c.restore()

    // Open cloak front: dark void with a glowing ribcage.
    polygon(c, [[CX - 52, 270], [CX + 52, 270], [CX + 80, 490], [CX - 80, 490]], css(COLORS.BG))
    glow(c, CX, 360, 90, COLORS.EMBER, 0.28)
    for (let i = 0; i < 5; i++) {
      const y = 296 + i * 28
      const w = 44 - i * 4
      c.beginPath()
      c.moveTo(CX - w, y + 10)
      c.quadraticCurveTo(CX, y - 14, CX + w, y + 10)
      c.lineWidth = 7
      c.lineCap = 'round'
      c.strokeStyle = css(darken(bone, 0.2 + i * 0.05))
      c.stroke()
    }
    line(c, [[CX, 276], [CX, 420]], css(darken(bone, 0.3)), 7)

    // Skull inside the hood.
    ellipse(c, CX, 186, 86, 100, rad(c, CX, 186, 10, 100, [[0, css(COLORS.BG)], [0.8, css(COLORS.INDIGO)], [1, css(cloak, 0)]]))
    skull(c, CX, 182, 62, s, { bone, eye: COLORS.PUMPKIN, cracked: true })
    // Hood rim over the brow.
    c.beginPath()
    c.moveTo(CX - 76, 150)
    c.quadraticCurveTo(CX, 62, CX + 76, 150)
    c.lineTo(CX + 90, 120)
    c.quadraticCurveTo(CX, 20, CX - 90, 120)
    c.closePath()
    c.fillStyle = css(darken(cloak, 0.3))
    c.fill()

    // Rusted chain across the chest.
    for (let i = 0; i < 11; i++) {
      const t = i / 10
      const x = CX - 100 + t * 190
      const y = 270 + Math.sin(t * Math.PI) * 70 + t * 20
      c.save()
      c.translate(x, y)
      c.rotate(i % 2 === 0 ? 0.5 : -0.5)
      c.beginPath()
      c.ellipse(0, 0, 10, 5.5, 0, 0, Math.PI * 2)
      c.lineWidth = 3.5
      c.strokeStyle = css(rust)
      c.stroke()
      c.restore()
    }

    // Reaching bony claw (left) and the lantern arm (right).
    const reachY = 350 - 100 * s.reach
    c.beginPath()
    c.moveTo(CX - 90, 300)
    c.quadraticCurveTo(CX - 150, 330, CX - 140, reachY + 24)
    c.lineTo(CX - 128, reachY + 36)
    c.quadraticCurveTo(CX - 120, 340, CX - 70, 340)
    c.closePath()
    c.fillStyle = css(darken(cloak, 0.1))
    c.fill()
    claw(c, CX - 140, reachY, -Math.PI / 2 - 0.5, 58, 16, css(bone), css(darken(bone, 0.5)))
    c.beginPath()
    c.moveTo(CX + 90, 300)
    c.quadraticCurveTo(CX + 140, 320, lx, 350 + swing)
    c.lineTo(lx - 12, 362 + swing)
    c.quadraticCurveTo(CX + 120, 350, CX + 70, 340)
    c.closePath()
    c.fillStyle = css(darken(cloak, 0.1))
    c.fill()
    claw(c, lx, 350 + swing, Math.PI / 2, 24, 13, css(bone), css(darken(bone, 0.5)))
    // Lantern.
    const ly = 400 + swing
    line(c, [[lx, 360 + swing], [lx, ly - 22]], css(rust), 4)
    glow(c, lx, ly + 14, 90, COLORS.PUMPKIN, 0.55)
    c.fillStyle = css(rust)
    c.fillRect(lx - 20, ly - 22, 40, 8)
    polygon(c, [[lx - 18, ly - 14], [lx + 18, ly - 14], [lx + 22, ly + 40], [lx - 22, ly + 40]], css(COLORS.EMBER, 0.9))
    polygon(c, [[lx - 8, ly - 4], [lx + 8, ly - 4], [lx + 4, ly + 28], [lx - 4, ly + 28]], css(0xfff0c0))
    c.fillStyle = css(rust)
    c.fillRect(lx - 24, ly + 40, 48, 8)
    for (const x of [lx - 18, lx + 18]) line(c, [[x, ly - 14], [x, ly + 40]], css(rust), 4)

    if (s.pose === 'hurt') crack(c, CX - 30, 300, 120, 5, css(COLORS.BG), COLORS.EMBER, 3)
    fog(c, CX, 470, 380, COLORS.INDIGO, 0.55, 8)
  })
}
