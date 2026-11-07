import Phaser from 'phaser'
import type { GateSpec } from '../world/DungeonLayout'
import type { Rect } from '../world/RoomLayout'
import { COLORS } from '../colors'
import { glowKey } from '../textures/registerGlow'
import { sfx } from '@/audio/sfx'

/** Iron-bar gate. Blocks movement while closed; open() removes the body. */
export class Gate {
  readonly zone: Phaser.GameObjects.Zone
  private readonly bars: Phaser.GameObjects.Graphics
  private opened = false
  private openable = false
  private glow: Phaser.GameObjects.Image | null = null

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

  /** Iron-banded gate: dark opening, vertical bars, two riveted iron bands. */
  private draw(): void {
    const { x, y, w, h } = this.rect
    const g = this.bars
    g.clear()
    g.fillStyle(COLORS.BG, 1)
    g.fillRect(x, y, w, h)
    g.fillStyle(0x6b6478, 1)
    for (let bx = x + 6; bx < x + w - 4; bx += 12) g.fillRect(bx, y, 4, h)
    g.fillStyle(0x9a92a8, 1)
    for (let bx = x + 6; bx < x + w - 4; bx += 12) g.fillRect(bx, y, 1, h)
    // Two iron bands with rivets.
    for (const by of [y + 5, y + h - 9]) {
      g.fillStyle(0x2c2733, 1)
      g.fillRect(x, by, w, 5)
      g.fillStyle(0x4b4457, 1)
      g.fillRect(x, by, w, 1)
      g.fillStyle(COLORS.BONE, 1)
      for (let bx = x + 8; bx < x + w - 4; bx += 24) g.fillRect(bx, by + 2, 2, 2)
    }
  }

  /** Warm glow while the gate can open (its room's monster is defeated). Idempotent. */
  setOpenable(): void {
    if (this.openable || this.opened) return
    this.openable = true
    if (!this.scene.textures.exists(glowKey('warm'))) return
    const cx = this.rect.x + this.rect.w / 2
    const cy = this.rect.y + this.rect.h
    const glow = this.scene.add
      .image(cx, cy, glowKey('warm'))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(this.rect.w * 1.6, 96)
      .setAlpha(0.4)
      .setDepth(3)
    this.glow = glow
    if (!this.reducedMotion) {
      this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.25, to: 0.55 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  open(): void {
    if (this.opened) return
    this.opened = true
    if (this.glow) {
      this.scene.tweens.killTweensOf(this.glow)
      this.glow.destroy()
      this.glow = null
    }
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
    this.glow?.destroy()
    this.glow = null
    this.bars.destroy()
    this.zone.destroy()
  }
}
