import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import { COLORS } from '../colors'
import { ensureFontsLoaded, waitForFonts } from '../fonts'

const FONT_WAIT_MS = 1500

const BAR_W = 320
const BAR_H = 16
const BOOT_DELAY_MS = 300

/** Draws a loading bar and generates procedural textures. No external files. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  create(): void {
    const x = (GAME_WIDTH - BAR_W) / 2
    const y = GAME_HEIGHT / 2
    const frame = this.add.graphics()
    frame.lineStyle(2, COLORS.INK_MUTED, 1)
    frame.strokeRect(x - 2, y - 2, BAR_W + 4, BAR_H + 4)
    const bar = this.add.graphics()

    const draw = (value: number): void => {
      bar.clear()
      bar.fillStyle(COLORS.MAGIC, 1)
      bar.fillRect(x, y, BAR_W * value, BAR_H)
    }
    // Nothing to download, but bind to the loader so real assets show progress later.
    this.load.on('progress', draw)

    this.makeTextures()
    draw(1)

    let delayDone = false
    let fontsDone = false
    const tryStart = (): void => {
      if (!delayDone || !fontsDone) return
      this.load.off('progress', draw)
      this.scene.start('GameScene')
    }
    this.time.delayedCall(BOOT_DELAY_MS, () => {
      delayDone = true
      tryStart()
    })
    const fontsReady =
      typeof document === 'undefined' ? undefined : (document.fonts?.ready as Promise<unknown> | undefined)
    void ensureFontsLoaded()
      .then(() => waitForFonts(fontsReady, FONT_WAIT_MS))
      .catch(() => undefined)
      .then(() => {
        fontsDone = true
        tryStart()
      })
  }

  private makeTextures(): void {
    const g = this.make.graphics({}, false)

    // Player: hooded adventurer (hood circle, face, cloak body)
    g.clear()
    g.fillStyle(COLORS.MAGIC, 1)
    g.fillRoundedRect(6, 14, 20, 18, 5)
    g.fillStyle(0x4d2d73, 1)
    g.fillCircle(16, 10, 9)
    g.fillStyle(COLORS.BG, 1)
    g.fillCircle(16, 11, 5)
    g.fillStyle(COLORS.ACCENT, 1)
    g.fillRect(13, 10, 2, 2)
    g.fillRect(18, 10, 2, 2)
    g.generateTexture('player', 32, 32)

    // Monster: ghostly skeleton scribe
    g.clear()
    g.fillStyle(COLORS.INK, 0.9)
    g.fillCircle(24, 16, 13)
    g.fillRect(11, 16, 26, 24)
    g.fillTriangle(11, 40, 18, 40, 14, 47)
    g.fillTriangle(20, 40, 28, 40, 24, 47)
    g.fillTriangle(30, 40, 37, 40, 34, 47)
    g.fillStyle(COLORS.BG, 1)
    g.fillCircle(18, 15, 3)
    g.fillCircle(30, 15, 3)
    g.fillRect(20, 22, 8, 3)
    g.fillStyle(COLORS.DANGER, 1)
    g.fillRect(17, 14, 2, 2)
    g.fillRect(29, 14, 2, 2)
    g.generateTexture('monster', 48, 48)

    // Slime: round blob with eyes
    g.clear()
    g.fillStyle(0x6fd17a, 0.95)
    g.fillEllipse(24, 32, 40, 28)
    g.fillCircle(24, 22, 12)
    g.fillStyle(0xd6f5da, 0.6)
    g.fillCircle(18, 20, 3)
    g.fillStyle(COLORS.BG, 1)
    g.fillCircle(19, 28, 3)
    g.fillCircle(29, 28, 3)
    g.generateTexture('monster-slime', 48, 48)

    // Gear golem: blocky body with gear teeth
    g.clear()
    g.fillStyle(0x9a8a6a, 1)
    g.fillRect(10, 12, 28, 30)
    g.fillStyle(0x6e6048, 1)
    for (let i = 0; i < 4; i++) {
      g.fillRect(8 + i * 10, 6, 6, 8)
    }
    g.fillRect(4, 22, 8, 12)
    g.fillRect(36, 22, 8, 12)
    g.fillStyle(COLORS.BG, 1)
    g.fillCircle(24, 26, 7)
    g.fillStyle(COLORS.ACCENT, 1)
    g.fillCircle(24, 26, 3)
    g.generateTexture('monster-gear', 48, 48)

    // Memory eater: wide maw with fangs
    g.clear()
    g.fillStyle(0x5a3b8a, 1)
    g.fillCircle(24, 22, 17)
    g.fillStyle(COLORS.BG, 1)
    g.fillEllipse(24, 30, 26, 14)
    g.fillStyle(COLORS.INK, 1)
    g.fillTriangle(13, 26, 18, 26, 15, 33)
    g.fillTriangle(22, 26, 27, 26, 24, 34)
    g.fillTriangle(31, 26, 36, 26, 33, 33)
    g.fillStyle(COLORS.ACCENT, 1)
    g.fillCircle(17, 14, 3)
    g.fillCircle(31, 14, 3)
    g.generateTexture('monster-eater', 48, 48)

    // Spark: small glowing dot
    g.clear()
    g.fillStyle(COLORS.ACCENT, 0.35)
    g.fillCircle(8, 8, 8)
    g.fillStyle(COLORS.INK, 1)
    g.fillCircle(8, 8, 4)
    g.generateTexture('spark', 16, 16)

    // Wall tile
    g.clear()
    g.fillStyle(COLORS.PANEL, 1)
    g.fillRect(0, 0, 32, 32)
    g.lineStyle(2, 0x2c2340, 1)
    g.strokeRect(1, 1, 30, 30)
    g.lineBetween(0, 16, 32, 16)
    g.lineBetween(16, 0, 16, 16)
    g.lineBetween(8, 16, 8, 32)
    g.lineBetween(24, 16, 24, 32)
    g.generateTexture('wall-tile', 32, 32)

    g.destroy()
  }
}
