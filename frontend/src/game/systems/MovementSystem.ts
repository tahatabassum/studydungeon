import Phaser from 'phaser'
import type { Player } from '../entities/Player'
import { combineMovement, movementVector } from './movementVector'
import { sfx } from '@/audio/sfx'

export const PLAYER_SPEED = 180

const CAPTURED = [
  Phaser.Input.Keyboard.KeyCodes.UP,
  Phaser.Input.Keyboard.KeyCodes.DOWN,
  Phaser.Input.Keyboard.KeyCodes.LEFT,
  Phaser.Input.Keyboard.KeyCodes.RIGHT,
  Phaser.Input.Keyboard.KeyCodes.SPACE,
]

const KC = Phaser.Input.Keyboard.KeyCodes

// Object form: Phaser returns an object keyed by these exact property names.
// (The comma-string form would key by the uppercase strings instead.)
const KEY_MAP = {
  w: KC.W,
  a: KC.A,
  s: KC.S,
  d: KC.D,
  up: KC.UP,
  down: KC.DOWN,
  left: KC.LEFT,
  right: KC.RIGHT,
}

type Keys = Record<keyof typeof KEY_MAP, Phaser.Input.Keyboard.Key>

/** WASD / arrow movement, active only while the scene phase is 'exploring'. */
export class MovementSystem {
  private readonly keys: Keys | null
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = []
  private captured = false
  private touchX = 0
  private touchY = 0
  private readonly mix = { x: 0, y: 0 }

  /** Virtual joystick vector from React (length at most 1). (0, 0) releases it. */
  setTouchVector(x: number, y: number): void {
    this.touchX = x
    this.touchY = y
  }

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly isExploring: () => boolean,
    obstacles: Phaser.Types.Physics.Arcade.ArcadeColliderType[],
  ) {
    const kb = scene.input.keyboard
    // enableCapture=false: keys are not preventDefault-ed, so React inputs keep working.
    this.keys = kb ? (kb.addKeys(KEY_MAP, false) as Keys) : null
    for (const o of obstacles) this.colliders.push(scene.physics.add.collider(player, o))
  }

  update(time: number): void {
    const exploring = this.isExploring()
    this.setCapture(exploring)
    const body = this.player.body as Phaser.Physics.Arcade.Body | null
    if (!body) return

    let dx = 0
    let dy = 0
    if (exploring) {
      let kx = 0
      let ky = 0
      if (this.keys) {
        const k = this.keys
        const v = movementVector({
          up: k.w.isDown || k.up.isDown,
          down: k.s.isDown || k.down.isDown,
          left: k.a.isDown || k.left.isDown,
          right: k.d.isDown || k.right.isDown,
        })
        kx = v.x
        ky = v.y
      }
      const out = combineMovement(kx, ky, this.touchX, this.touchY, this.mix)
      dx = out.x
      dy = out.y
    }
    if (dx !== 0 || dy !== 0) sfx.play('footstep') // rate-limited inside the engine
    this.player.setVelocity(dx * PLAYER_SPEED, dy * PLAYER_SPEED)
    this.player.tick(time, dx, dy)
  }

  /** Capture arrows/space only while exploring so React gets keys otherwise. */
  private setCapture(on: boolean): void {
    if (on === this.captured) return
    this.captured = on
    const kb = this.scene.input.keyboard
    if (!kb) return
    if (on) kb.addCapture(CAPTURED)
    else kb.removeCapture(CAPTURED)
  }

  destroy(): void {
    this.setCapture(false)
    for (const c of this.colliders) c.destroy()
    this.colliders.length = 0
    const kb = this.scene.input.keyboard
    if (kb && this.keys) {
      for (const k of Object.values(this.keys)) kb.removeKey(k, true)
    }
  }
}
