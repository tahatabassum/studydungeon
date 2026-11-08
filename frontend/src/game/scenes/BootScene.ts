import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'
import { COLORS } from '../colors'
import { ensureFontsLoaded, waitForFonts } from '../fonts'
import { registerArt } from '../textures/registerArt'
import { registerGlow } from '../textures/registerGlow'
import { registerPieces } from '../textures/registerPieces'

const FONT_WAIT_MS = 1500

const BAR_W = 320
const BAR_H = 16
const BOOT_DELAY_MS = 300

/** Draws a loading bar and generates textures (pixel art maps and a few procedural ones). */
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

    registerArt(this)
    registerGlow(this)
    registerPieces(this)
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
