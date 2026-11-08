import Phaser from 'phaser'
import { bossPhase, type BossPhase } from '../bossPhase'
import type { GameBridge } from '../events'
import type { Monster } from '../entities/Monster'
import type { AnimatedPieces } from './AnimatedPieces'
import type { AtmosphereSystem } from './AtmosphereSystem'

const TINT_DEPTH = 94
const TINT_COLOR = 0x8a1020
const TINT_ALPHA = 0.12
const TINT_FADE_MS = 500

export interface BossPhaseHosts {
  atmosphere: () => AtmosphereSystem | null
  pieces: () => AnimatedPieces | null
}

/**
 * Presents the boss phase. The phase comes ONLY from the HP values the backend sent
 * (bossPhase(hp, maxHp)); this system never computes damage or HP.
 *
 * Enraged: the sprite tint shifts red, a faint red screen tint appears, the attack becomes a
 * heavier lunge and roar (Monster.playAttack), extra fog is added and the boss hall lightning
 * runs more often (spacing >= 8 s, peak alpha 0.25). Under Reduced_Motion only the tints apply.
 * Every phase change is announced once through the additive boss-phase-changed event.
 */
export class BossPhaseSystem {
  private phase: BossPhase = 'normal'
  private monster: Monster | null = null
  private overlay: Phaser.GameObjects.Rectangle | null = null

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bridge: GameBridge | undefined,
    private readonly isReduced: () => boolean,
    private readonly hosts: BossPhaseHosts,
  ) {}

  get current(): BossPhase {
    return this.phase
  }

  /** Called with each authoritative monster HP; only the boss changes the phase. */
  onMonsterHp(monster: Monster, hp: number): void {
    if (!monster.isBoss) return
    const next = bossPhase(hp, monster.maxHp)
    if (next === this.phase) return
    this.phase = next
    this.monster = monster
    this.apply()
    this.bridge?.emit({ type: 'boss-phase-changed', phase: next })
  }

  /** Re-applies the current phase after a room change rebuilt the room visuals. */
  reapply(): void {
    if (this.phase === 'enraged') this.apply()
  }

  /** Back to normal without a monster (room rebuild / restart). Announces the change once. */
  reset(announce: boolean): void {
    const was = this.phase
    this.phase = 'normal'
    this.monster = null
    this.apply()
    if (announce && was !== 'normal') this.bridge?.emit({ type: 'boss-phase-changed', phase: 'normal' })
  }

  destroy(): void {
    if (this.overlay) this.scene.tweens.killTweensOf(this.overlay)
    this.overlay?.destroy()
    this.overlay = null
    this.monster = null
  }

  private apply(): void {
    const on = this.phase === 'enraged'
    this.monster?.setEnraged(on)
    this.hosts.atmosphere()?.setEnraged(on)
    this.hosts.pieces()?.setEnraged(on)
    this.showTint(on)
  }

  private showTint(on: boolean): void {
    if (!on && !this.overlay) return
    if (!this.overlay) {
      this.overlay = this.scene.add
        .rectangle(0, 0, 4000, 4000, TINT_COLOR, 1)
        .setScrollFactor(0)
        .setDepth(TINT_DEPTH)
        .setAlpha(0)
    }
    const o = this.overlay
    const cam = this.scene.cameras.main
    o.setPosition(cam.width / 2, cam.height / 2)
    this.scene.tweens.killTweensOf(o)
    const target = on ? TINT_ALPHA : 0
    if (this.isReduced()) {
      o.setAlpha(target)
      return
    }
    this.scene.tweens.add({ targets: o, alpha: target, duration: TINT_FADE_MS, ease: 'Sine.easeInOut' })
  }
}
