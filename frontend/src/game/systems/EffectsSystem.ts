import Phaser from 'phaser'
import type { AnswerResult } from '@/types/api'
import type { GameBridge } from '../events'
import type { Gate } from '../entities/Gate'
import type { Monster } from '../entities/Monster'
import type { Player } from '../entities/Player'
import { planCombat } from './combatPlan'

const PROJECTILE_MS = 250
const LUNGE_MS = 160
const FALLBACK_MS = 1200

export interface EffectsTargets {
  player: Player | null
  monster: Monster | null
  gate: Gate | null
}

/** Executes a combat plan using only AnswerResult values. Emits result-animation-done once. */
export class EffectsSystem {
  private timers: Phaser.Time.TimerEvent[] = []
  private finishPending: (() => void) | null = null

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bridge: GameBridge | undefined,
    private readonly targets: () => EffectsTargets,
    private readonly isReduced: () => boolean,
  ) {}

  private later(ms: number, fn: () => void): void {
    if (ms <= 0) {
      fn()
      return
    }
    this.timers.push(this.scene.time.delayedCall(ms, fn))
  }

  /** Drop pending work without emitting (used on reset / shutdown). */
  cancel(): void {
    for (const t of this.timers) t.remove(false)
    this.timers = []
    this.finishPending = null
  }

  apply(result: AnswerResult): void {
    // A newer result supersedes an unfinished one; settle the old one first.
    this.finishPending?.()
    this.cancel()

    const reduced = this.isReduced()
    const plan = planCombat(result, reduced)
    const has = (s: (typeof plan.steps)[number]): boolean => plan.steps.includes(s)
    const { player, monster, gate } = this.targets()

    let finished = false
    const finish = (): void => {
      if (finished) return
      finished = true
      this.finishPending = null
      this.bridge?.emit({ type: 'result-animation-done' })
    }
    this.finishPending = finish

    let impact = 0
    if (has('projectile') && player && monster && !reduced) {
      this.fireProjectile(player, monster)
      impact = PROJECTILE_MS
    } else if (has('monster-attack') && player && monster) {
      monster.nudge(player.x < monster.position.x ? -28 : 28, LUNGE_MS)
      impact = reduced ? 0 : LUNGE_MS
    }

    this.later(impact, () => {
      if (has('hit-flash')) monster?.flash()
      if (result.correct && monster) {
        monster.nudge(player && player.x < monster.position.x ? 6 : -6, 60)
      }
      if (has('damage-number') && plan.damageText && monster) {
        this.floatText(monster.position.x, monster.position.y - 40, plan.damageText, '#E9A23B', reduced)
      }
      if (has('monster-hp')) monster?.setHp(result.monster_hp_remaining, true)
      if (has('player-flash')) player?.flashHit()
      if (has('camera-shake')) this.scene.cameras.main.shake(plan.shakeMs, 0.004)
      if (!result.correct && player) {
        this.floatText(player.x, player.y - 30, 'Ouch!', '#B83D4A', reduced)
      }
    })

    let end = impact + (reduced ? 0 : 320)
    if (has('monster-defeat')) {
      this.later(impact + (reduced ? 0 : 120), () => {
        monster?.defeat()
        if (monster && !reduced) this.burst(monster.position.x, monster.position.y)
      })
      end = impact + (reduced ? 0 : 420)
      if (has('gate-open')) this.later(end, () => gate?.open())
      end += reduced ? 0 : 80
    }
    this.later(end, finish)
    // Safety net: always emit within FALLBACK_MS.
    this.timers.push(this.scene.time.delayedCall(FALLBACK_MS, finish))
  }

  /** Idempotent gate open for the explicit room-cleared event. */
  openGate(gate: Gate | null): void {
    gate?.open()
  }

  private ensureSpark(): void {
    if (this.scene.textures.exists('spark')) return
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false)
    g.fillStyle(0xffffff, 1)
    g.fillCircle(6, 6, 6)
    g.generateTexture('spark', 12, 12)
    g.destroy()
  }

  private fireProjectile(player: Player, monster: Monster): void {
    this.ensureSpark()
    const { scene } = this
    const to = monster.position
    const head = scene.add.image(player.x, player.y, 'spark').setTint(0xe9a23b).setDepth(20)
    const trail = scene.add
      .image(player.x, player.y, 'spark')
      .setTint(0x7546a8)
      .setScale(1.6)
      .setAlpha(0.6)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(19)
    scene.tweens.add({
      targets: head,
      x: to.x,
      y: to.y,
      duration: PROJECTILE_MS,
      ease: 'Quad.easeIn',
      onComplete: () => head.destroy(),
    })
    scene.tweens.add({
      targets: trail,
      x: to.x,
      y: to.y,
      delay: 40,
      duration: PROJECTILE_MS,
      ease: 'Quad.easeIn',
      onComplete: () => trail.destroy(),
    })
  }

  private floatText(x: number, y: number, text: string, color: string, reduced: boolean): void {
    const t = this.scene.add
      .text(x, y, text, {
        fontFamily: 'serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color,
        stroke: '#100D18',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(30)
    if (reduced) {
      this.scene.time.delayedCall(600, () => t.destroy())
      return
    }
    this.scene.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 700,
      ease: 'Sine.easeOut',
      onComplete: () => t.destroy(),
    })
  }

  private burst(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8
      const c = this.scene.add.circle(x, y, 4, i % 2 ? 0x7546a8 : 0xe9a23b, 1).setDepth(20)
      this.scene.tweens.add({
        targets: c,
        x: x + Math.cos(a) * 40,
        y: y + Math.sin(a) * 40,
        alpha: 0,
        duration: 450,
        onComplete: () => c.destroy(),
      })
    }
  }
}
