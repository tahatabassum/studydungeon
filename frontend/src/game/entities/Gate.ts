import Phaser from 'phaser'
import type { GateSpec } from '../world/DungeonLayout'
import type { Rect } from '../world/RoomLayout'
import { COLORS } from '../colors'
import { sfx } from '@/audio/sfx'

/** Iron-bar gate. Blocks movement while closed; open() removes the body. */
export class Gate {
  readonly zone: Phaser.GameObjects.Zone
  private readonly bars: Phaser.GameObjects.Graphics
  private opened = false

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rect: Rect,
    private readonly reducedMotion: boolean,
    private readonly roomId?: string,
    private readonly onOpened?: (roomId: string) => void,
    private readonly onPuff?: (x: number, y: number) => void,
  ) {
    this.bars = scene.add.graphics().setDepth(2)
    this.draw()
    this.zone = scene.add.zone(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h)
    scene.physics.add.existing(this.zone, true)
  }

  /** Create a gate from a layout GateSpec. */
  static fromSpec(
    scene: Phaser.Scene,
    spec: GateSpec,
    reducedMotion: boolean,
    onOpened?: (roomId: string) => void,
    onPuff?: (x: number, y: number) => void,
  ): Gate {
    return new Gate(scene, spec.rect, reducedMotion, spec.afterRoomId, onOpened, onPuff)
  }

  get isOpen(): boolean {
    return this.opened
  }

  private draw(): void {
    const { x, y, w, h } = this.rect
    const g = this.bars
    g.clear()
    g.fillStyle(COLORS.BG, 1)
    g.fillRect(x, y, w, h)
    g.fillStyle(COLORS.INK_MUTED, 1)
    for (let bx = x + 6; bx < x + w - 4; bx += 12) g.fillRect(bx, y, 4, h)
    g.fillStyle(COLORS.DANGER, 1)
    g.fillRect(x, y + h / 2 - 2, w, 4)
  }

  open(): void {
    if (this.opened) return
    this.opened = true
    const body = this.zone.body as Phaser.Physics.Arcade.StaticBody | null
    if (body) body.enable = false
    if (this.roomId !== undefined) this.onOpened?.(this.roomId)
    sfx.play('gate')
    if (this.reducedMotion) {
      this.bars.setAlpha(0.15)
      return
    }
    this.onPuff?.(this.rect.x + this.rect.w / 2, this.rect.y + this.rect.h)
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
