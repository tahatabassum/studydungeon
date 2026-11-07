import Phaser from 'phaser'
import type { Point } from '../world/RoomLayout'

/** Arcade sprite using the procedural 'player' texture, with glow, breathing and walk bob. */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly glow: Phaser.GameObjects.Ellipse
  private moving = false
  private readonly reducedMotion: boolean

  constructor(scene: Phaser.Scene, at: Point, reducedMotion: boolean) {
    super(scene, at.x, at.y, 'player')
    this.reducedMotion = reducedMotion
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setDepth(10)
    this.setCollideWorldBounds(true)
    // Slightly smaller circular body, centered toward the feet.
    this.setCircle(10, 6, 10)

    this.glow = scene.add
      .ellipse(at.x, at.y + 14, 28, 10, 0xe9a23b, 0.28)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9)
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.glow.destroy())
  }

  /** Called every frame with the intended velocity direction. */
  tick(time: number, dirX: number, dirY: number): void {
    this.moving = dirX !== 0 || dirY !== 0
    if (dirX !== 0) this.setFlipX(dirX < 0)

    if (this.reducedMotion) {
      this.setScale(1, 1)
    } else if (this.moving) {
      // Walk bob
      const s = Math.sin(time / 60)
      this.setScale(1, 1 + 0.05 * s)
      this.setAngle(2 * s)
    } else {
      // Idle breathing
      this.setAngle(0)
      this.setScale(1, 1 + 0.03 * Math.sin(time / 350))
    }
    this.glow.setPosition(this.x, this.y + 14)
  }

  /** Brief red hit tint (callers skip this for reduced motion). */
  flashHit(): void {
    this.setTintFill(0xb83d4a)
    this.scene.time.delayedCall(140, () => {
      if (this.active) this.clearTint()
    })
  }

  get isMoving(): boolean {
    return this.moving
  }
}
