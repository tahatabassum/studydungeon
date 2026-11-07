import Phaser from 'phaser'
import type { Monster } from '../entities/Monster'
import type { Player } from '../entities/Player'
import type { GameBridge, GamePhase } from '../events'
import { isWithinRange } from './interaction'

/** Shows "Press E to fight" near a living monster and emits encounter-started once. */
export class InteractionSystem {
  private readonly keyE: Phaser.Input.Keyboard.Key | null
  private readonly keySpace: Phaser.Input.Keyboard.Key | null
  private readonly prompt: Phaser.GameObjects.Text
  private pulse: Phaser.Tweens.Tween | null = null
  private armed = true

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly monster: Monster,
    private readonly getPhase: () => GamePhase,
    private readonly bridge: GameBridge | undefined,
    reducedMotion: boolean,
  ) {
    const kb = scene.input.keyboard
    // enableCapture=false so React inputs keep receiving these keys.
    this.keyE = kb ? kb.addKey(Phaser.Input.Keyboard.KeyCodes.E, false) : null
    this.keySpace = kb ? kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false) : null

    this.prompt = scene.add
      .text(monster.position.x, monster.position.y - 76, 'Press E to fight', {
        fontFamily: 'serif',
        fontSize: '14px',
        color: '#F2E8D5',
        backgroundColor: '#100D18',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 1)
      .setDepth(20)
      .setVisible(false)

    if (!reducedMotion) {
      this.pulse = scene.tweens.add({
        targets: this.prompt,
        alpha: { from: 0.7, to: 1 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  update(): void {
    const exploring = this.getPhase() === 'exploring'
    if (!exploring) {
      this.armed = true // re-arm once the phase leaves exploring
      this.prompt.setVisible(false)
      this.consumeKeys()
      return
    }
    const inRange =
      this.monster.alive &&
      isWithinRange({ x: this.player.x, y: this.player.y }, this.monster.position)
    this.prompt.setVisible(inRange)
    const pressed = this.consumeKeys()
    if (inRange && pressed && this.armed) {
      // Stay disarmed until the phase changes away from exploring and back.
      this.armed = false
      this.bridge?.emit({ type: 'encounter-started', monsterId: this.monster.id })
    }
  }

  /** Reads JustDown on both keys (so stale presses don't linger). */
  private consumeKeys(): boolean {
    const e = this.keyE ? Phaser.Input.Keyboard.JustDown(this.keyE) : false
    const s = this.keySpace ? Phaser.Input.Keyboard.JustDown(this.keySpace) : false
    return e || s
  }

  destroy(): void {
    this.pulse?.stop()
    this.prompt.destroy()
    const kb = this.scene.input.keyboard
    if (kb) {
      if (this.keyE) kb.removeKey(this.keyE, true)
      if (this.keySpace) kb.removeKey(this.keySpace, true)
    }
  }
}
