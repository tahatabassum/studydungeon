import Phaser from 'phaser'
import type { Point } from '../world/RoomLayout'
import { COLORS } from '../colors'
import { PLAYER_IDLE_ANIM, PLAYER_IDLE_TEXTURE, PLAYER_WALK_ANIM } from '../textures/registerArt'

/** Arcade sprite using the pixel-art player: idle bob when still, 2-frame walk while moving. */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly glow: Phaser.GameObjects.Ellipse
  private moving = false
  private mode: 'idle' | 'walk' = 'idle'
  private readonly reducedMotion: boolean

  constructor(scene: Phaser.Scene, at: Point, reducedMotion: boolean) {
    super(scene, at.x, at.y, PLAYER_IDLE_TEXTURE)
    this.reducedMotion = reducedMotion
    scene.add.existing(this)
    scene.physics.add.existing(this)
    this.setDepth(10)
    this.setCollideWorldBounds(true)
    // Circular body (radius 10 world px) centered slightly below the sprite center.
    this.setCircle(10, 14, 17)

    this.glow = scene.add
      .ellipse(at.x, at.y + 20, 28, 10, COLORS.ACCENT, 0.28)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9)
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.glow.destroy())

    // Reduced motion keeps the static idle frame.
    if (!reducedMotion) this.play(PLAYER_IDLE_ANIM)
  }

  /** Called every frame with the intended velocity direction. */
  tick(time: number, dirX: number, dirY: number): void {
    this.moving = dirX !== 0 || dirY !== 0
    if (dirX !== 0) this.setFlipX(dirX < 0)
    // Subtle cape and hat sway: a slight rock every 600 ms (static under reduced motion).
    this.setAngle(this.reducedMotion ? 0 : Math.sin((time / 600) * Math.PI) * (this.moving ? 2.5 : 1.2))

    if (!this.reducedMotion) {
      const next = this.moving ? 'walk' : 'idle'
      if (next !== this.mode) {
        this.mode = next
        this.play(next === 'walk' ? PLAYER_WALK_ANIM : PLAYER_IDLE_ANIM)
      }
    }
    this.glow.setPosition(this.x, this.y + 20)
  }

  /** Brief red hit tint (callers skip this for reduced motion). */
  flashHit(): void {
    this.setTintFill(COLORS.DANGER)
    this.scene.time.delayedCall(140, () => {
      if (this.active) this.clearTint()
    })
  }

  get isMoving(): boolean {
    return this.moving
  }
}
