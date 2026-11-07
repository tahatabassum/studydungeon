import Phaser from 'phaser'
import type { AnswerResult } from '@/types/api'
import type { GameBridge } from '../events'
import type { Gate } from '../entities/Gate'
import type { Monster } from '../entities/Monster'
import type { Player } from '../entities/Player'
import { planCombat } from './combatPlan'
import { COLORS, CSS_COLORS } from '../colors'
import { FONT_DISPLAY } from '../fonts'
import { sfx } from '@/audio/sfx'
import { ObjectPool } from './objectPool'
import { ensureSparkTexture } from './sparkTexture'

const PROJECTILE_MS = 250
const LUNGE_MS = 160
const FALLBACK_MS = 1200
const SPARK_POOL = 24
const TEXT_POOL = 4

export interface EffectsTargets {
  player: Player | null
  monster: Monster | null
  gate: Gate | null
}

/** Executes a combat plan using only AnswerResult values. Emits result-animation-done once. */
export class EffectsSystem {
  private timers: Phaser.Time.TimerEvent[] = []
  private finishPending: (() => void) | null = null
  private readonly sparks: ObjectPool<Phaser.GameObjects.Image>
  private readonly texts: ObjectPool<Phaser.GameObjects.Text>

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bridge: GameBridge | undefined,
    private readonly targets: () => EffectsTargets,
    private readonly isReduced: () => boolean,
  ) {
    this.sparks = new ObjectPool({
      create: () => scene.add.image(0, 0, 'spark'),
      reset: (img) =>
        img
          .clearTint()
          .setScale(1)
          .setAlpha(1)
          .setBlendMode(Phaser.BlendModes.NORMAL)
          .setVisible(true)
          .setActive(true),
      max: SPARK_POOL,
    })
    this.texts = new ObjectPool({
      create: () =>
        scene.add
          .text(0, 0, '', {
            fontFamily: FONT_DISPLAY,
            fontSize: '24px',
            fontStyle: 'bold',
            color: CSS_COLORS.ACCENT,
            stroke: CSS_COLORS.BG,
            strokeThickness: 4,
          })
          .setOrigin(0.5),
      reset: (t) => t.setAlpha(1).setVisible(true).setActive(true),
      max: TEXT_POOL,
    })
  }

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
      sfx.play('attack')
      impact = PROJECTILE_MS
    } else if (has('monster-attack') && player && monster) {
      sfx.play('attack')
      monster.playAttack()
      monster.nudge(player.x < monster.position.x ? -28 : 28, LUNGE_MS)
      impact = reduced ? 0 : LUNGE_MS
    }

    this.later(impact, () => {
      sfx.play('hit')
      if (has('hit-flash')) monster?.flash()
      if (result.correct) monster?.playHit()
      if (result.correct && monster) {
        monster.nudge(player && player.x < monster.position.x ? 6 : -6, 60)
      }
      if (has('damage-number') && plan.damageText && monster) {
        this.floatText(monster.position.x, monster.position.y - 40, plan.damageText, CSS_COLORS.ACCENT, reduced)
      }
      if (has('monster-hp')) monster?.setHp(result.monster_hp_remaining, true)
      if (has('player-flash')) player?.flashHit()
      if (has('camera-shake')) this.scene.cameras.main.shake(plan.shakeMs, 0.004)
      if (!result.correct && player) {
        this.floatText(player.x, player.y - 30, 'Ouch!', CSS_COLORS.DANGER, reduced)
      }
    })

    let end = impact + (reduced ? 0 : 320)
    if (has('monster-defeat')) {
      this.later(impact + (reduced ? 0 : 120), () => {
        monster?.playDeath()
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

  /** Idempotent gate open for the explicit gate-open event. */
  openGate(gate: Gate | null): void {
    gate?.open()
  }

  /** Drop in-flight visuals and return pooled objects (used when the room is rebuilt). */
  reset(): void {
    this.cancel()
    for (const o of this.sparks.active()) this.scene.tweens.killTweensOf(o)
    for (const o of this.texts.active()) this.scene.tweens.killTweensOf(o)
    this.sparks.releaseAll()
    this.texts.releaseAll()
  }

  destroy(): void {
    this.cancel()
    this.sparks.clear((o) => o.destroy())
    this.texts.clear((o) => o.destroy())
  }

  /** Small dust puff (gate opening). Skipped under reduced motion. */
  puff(x: number, y: number): void {
    if (this.isReduced()) return
    for (let i = 0; i < 6; i++) {
      const img = this.acquireSpark()
      if (!img) return
      const dir = i < 3 ? -1 : 1
      img.setPosition(x, y).setTint(0xb9aec9).setScale(0.6).setAlpha(0.6).setDepth(12)
      this.releaseOnComplete(img, {
        x: x + dir * (10 + (i % 3) * 12),
        y: y - 8 - (i % 3) * 6,
        alpha: 0,
        scale: 1.1,
        duration: 500,
        ease: 'Sine.easeOut',
      })
    }
  }

  private acquireSpark(): Phaser.GameObjects.Image | null {
    ensureSparkTexture(this.scene)
    return this.sparks.acquire()
  }

  private releaseOnComplete(
    img: Phaser.GameObjects.Image,
    props: Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'>,
  ): void {
    this.scene.tweens.add({
      targets: img,
      ...props,
      onComplete: () => this.sparks.release(img),
    })
  }

  private fireProjectile(player: Player, monster: Monster): void {
    const to = monster.position
    const head = this.acquireSpark()
    const trail = this.acquireSpark()
    if (head) {
      head.setPosition(player.x, player.y).setTint(COLORS.ACCENT).setDepth(20)
      this.releaseOnComplete(head, { x: to.x, y: to.y, duration: PROJECTILE_MS, ease: 'Quad.easeIn' })
    }
    if (trail) {
      trail
        .setPosition(player.x, player.y)
        .setTint(COLORS.MAGIC)
        .setScale(1.6)
        .setAlpha(0.6)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(19)
      this.releaseOnComplete(trail, { x: to.x, y: to.y, delay: 40, duration: PROJECTILE_MS, ease: 'Quad.easeIn' })
    }
  }

  private floatText(x: number, y: number, text: string, color: string, reduced: boolean): void {
    const t = this.texts.acquire()
    if (!t) return
    t.setText(text).setColor(color).setPosition(x, y).setDepth(30)
    if (reduced) {
      this.scene.time.delayedCall(600, () => this.texts.release(t))
      return
    }
    this.scene.tweens.add({
      targets: t,
      y: y - 40,
      alpha: 0,
      duration: 700,
      ease: 'Sine.easeOut',
      onComplete: () => this.texts.release(t),
    })
  }

  private burst(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8
      const c = this.acquireSpark()
      if (!c) return
      c.setPosition(x, y).setTint(i % 2 ? COLORS.MAGIC : COLORS.ACCENT).setScale(0.7).setDepth(20)
      this.releaseOnComplete(c, {
        x: x + Math.cos(a) * 40,
        y: y + Math.sin(a) * 40,
        alpha: 0,
        duration: 450,
      })
    }
  }
}
