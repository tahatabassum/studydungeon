import Phaser from 'phaser'
import type { Monster } from '../entities/Monster'
import type { Player } from '../entities/Player'
import type { GameBridge, GamePhase } from '../events'
import { isWithinRange, shouldEngage } from './interaction'
import { sfx } from '@/audio/sfx'
import { CSS_COLORS } from '../colors'
import { FONT_LABEL } from '../fonts'

/** Shows "Press E to engage" near a living monster and emits encounter-started once. */
export class InteractionSystem {
  private readonly keyE: Phaser.Input.Keyboard.Key | null
  private readonly keySpace: Phaser.Input.Keyboard.Key | null
  private readonly prompt: Phaser.GameObjects.Text
  private pulse: Phaser.Tweens.Tween | null = null
  private armed = true
  private readonly getMonster: () => Monster | null

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    monster: Monster | (() => Monster | null),
    private readonly getPhase: () => GamePhase,
    private readonly bridge: GameBridge | undefined,
    reducedMotion: boolean,
  ) {
    this.getMonster = typeof monster === 'function' ? monster : () => monster
    const initial = this.getMonster()
    const kb = scene.input.keyboard
    // enableCapture=false so React inputs keep receiving these keys.
    this.keyE = kb ? kb.addKey(Phaser.Input.Keyboard.KeyCodes.E, false) : null
    this.keySpace = kb ? kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false) : null

    this.prompt = scene.add
      .text(initial?.position.x ?? 0, (initial?.position.y ?? 0) - 76, 'Press E to engage', {
        fontFamily: FONT_LABEL,
        fontSize: '14px',
        color: CSS_COLORS.INK,
        backgroundColor: CSS_COLORS.BG,
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
    const phase = this.getPhase()
    const pressed = this.consumeKeys()
    const held = this.engageKeyHeld()
    // Re-arm when not exploring or no engage key is held (a key held through combat must not re-engage).
    if (phase !== 'exploring' || !held) this.armed = true
    if (phase !== 'exploring') {
      this.prompt.setVisible(false)
      return
    }
    const monster = this.getMonster()
    const alive = !!monster && monster.alive
    const inRange =
      !!monster && isWithinRange({ x: this.player.x, y: this.player.y }, monster.position)
    this.prompt.setVisible(alive && inRange)
    if (monster && shouldEngage({ phase, inRange, alive, pressed, armed: this.armed })) {
      this.armed = false
      sfx.play('growl')
      this.bridge?.emit({ type: 'encounter-started', monsterId: monster.id })
    }
  }

  private engageKeyHeld(): boolean {
    return !!(this.keyE?.isDown || this.keySpace?.isDown)
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
