import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config'

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
    frame.lineStyle(2, 0xa79cb5, 1)
    frame.strokeRect(x - 2, y - 2, BAR_W + 4, BAR_H + 4)
    const bar = this.add.graphics()

    const draw = (value: number): void => {
      bar.clear()
      bar.fillStyle(0x7546a8, 1)
      bar.fillRect(x, y, BAR_W * value, BAR_H)
    }
    // Nothing to download, but bind to the loader so real assets show progress later.
    this.load.on('progress', draw)

    this.makeTextures()
    draw(1)

    this.time.delayedCall(BOOT_DELAY_MS, () => {
      this.load.off('progress', draw)
      this.scene.start('GameScene')
    })
  }

  private makeTextures(): void {
    const g = this.make.graphics({}, false)

    // Player: hooded adventurer (hood circle, face, cloak body)
    g.clear()
    g.fillStyle(0x7546a8, 1)
    g.fillRoundedRect(6, 14, 20, 18, 5)
    g.fillStyle(0x4d2d73, 1)
    g.fillCircle(16, 10, 9)
    g.fillStyle(0x100d18, 1)
    g.fillCircle(16, 11, 5)
    g.fillStyle(0xe9a23b, 1)
    g.fillRect(13, 10, 2, 2)
    g.fillRect(18, 10, 2, 2)
    g.generateTexture('player', 32, 32)

    // Monster: ghostly skeleton scribe
    g.clear()
    g.fillStyle(0xf2e8d5, 0.9)
    g.fillCircle(24, 16, 13)
    g.fillRect(11, 16, 26, 24)
    g.fillTriangle(11, 40, 18, 40, 14, 47)
    g.fillTriangle(20, 40, 28, 40, 24, 47)
    g.fillTriangle(30, 40, 37, 40, 34, 47)
    g.fillStyle(0x100d18, 1)
    g.fillCircle(18, 15, 3)
    g.fillCircle(30, 15, 3)
    g.fillRect(20, 22, 8, 3)
    g.fillStyle(0xb83d4a, 1)
    g.fillRect(17, 14, 2, 2)
    g.fillRect(29, 14, 2, 2)
    g.generateTexture('monster', 48, 48)

    // Spark: small glowing dot
    g.clear()
    g.fillStyle(0xe9a23b, 0.35)
    g.fillCircle(8, 8, 8)
    g.fillStyle(0xf2e8d5, 1)
    g.fillCircle(8, 8, 4)
    g.generateTexture('spark', 16, 16)

    // Wall tile
    g.clear()
    g.fillStyle(0x1d1728, 1)
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
