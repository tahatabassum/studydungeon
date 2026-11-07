import Phaser from 'phaser'
import type { Rect } from '../world/RoomLayout'

/** Iron-bar gate. Blocks movement while closed; open() removes the body. */
export class Gate {
  readonly zone: Phaser.GameObjects.Zone
  private readonly bars: Phaser.GameObjects.Graphics
  private opened = false

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rect: Rect,
    private readonly reducedMotion: boolean,
  ) {
    this.bars = scene.add.graphics().setDepth(2)
    this.draw()
    this.zone = scene.add.zone(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h)
    scene.physics.add.existing(this.zone, true)
  }

  get isOpen(): boolean {
    return this.opened
  }

  private draw(): void {
    const { x, y, w, h } = this.rect
    const g = this.bars
    g.clear()
    g.fillStyle(0x100d18, 1)
    g.fillRect(x, y, w, h)
    g.fillStyle(0xa79cb5, 1)
    for (let bx = x + 6; bx < x + w - 4; bx += 12) g.fillRect(bx, y, 4, h)
    g.fillStyle(0xb83d4a, 1)
    g.fillRect(x, y + h / 2 - 2, w, 4)
  }

  open(): void {
    if (this.opened) return
    this.opened = true
    const body = this.zone.body as Phaser.Physics.Arcade.StaticBody | null
    if (body) body.enable = false
    if (this.reducedMotion) {
      this.bars.setAlpha(0.15)
      return
    }
    this.scene.tweens.add({
      targets: this.bars,
      alpha: 0.15,
      y: -this.rect.h * 0.6,
      duration: 700,
      ease: 'Sine.easeInOut',
    })
  }

  destroy(): void {
    this.bars.destroy()
    this.zone.destroy()
  }
}
