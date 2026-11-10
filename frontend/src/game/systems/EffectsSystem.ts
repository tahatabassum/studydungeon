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
import { feedbackPlan, type FeedbackPlan } from './feedback'
import { ObjectPool } from './objectPool'
import { ensureSparkTexture } from './sparkTexture'
import type { EncounterFxSystem } from './EncounterFxSystem'
import { createOnceLatch } from './onceLatch'
import type { BossPhaseSystem } from './BossPhaseSystem'
import type { WeaponFxSystem, StrikeTarget } from './WeaponFxSystem'
import type { HitStopSystem } from './HitStopSystem'
import type { BossDeathSystem } from './BossDeathSystem'
import { planHit } from '../fx/effectPlan'

const PROJECTILE_MS = 250
const LUNGE_MS = 160
const FALLBACK_MS = 1200
const SPARK_POOL = 24
const TEXT_POOL = 4
const TINT_POOL = 2
/** Purple-red used for the curse tint. */
const CURSE_COLOR = 0x8a2a5c

/** Optional Phase 3 collaborators: weapon strikes (with critical flash) and the boss phase. */
export interface EffectsExtras {
  weapons?: WeaponFxSystem
  boss?: BossPhaseSystem
  /** Phase 5 game feel: hit-stop on strong hits and the boss death sequence. */
  hitStop?: HitStopSystem
  bossDeath?: BossDeathSystem
}

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
  private readonly tints: ObjectPool<Phaser.GameObjects.Rectangle>

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bridge: GameBridge | undefined,
    private readonly targets: () => EffectsTargets,
    private readonly isReduced: () => boolean,
    private readonly fx?: EncounterFxSystem,
    private readonly extras: EffectsExtras = {},
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
      reset: (t) => t.setAlpha(1).setScale(1).setVisible(true).setActive(true),
      max: TEXT_POOL,
    })
    this.tints = new ObjectPool({
      create: () =>
        scene.add
          .rectangle(0, 0, 4000, 4000, CURSE_COLOR, 1)
          .setScrollFactor(0)
          .setDepth(95),
      reset: (r) => r.setAlpha(0).setVisible(true).setActive(true),
      max: TINT_POOL,
    })
  }

  private later(ms: number, fn: () => void): void {
    if (ms <= 0) {
      fn()
      return
    }
    this.timers.push(this.scene.time.delayedCall(ms, fn))
  }

  /** Pooled sparks alive now (for the debug report). */
  get activeCount(): number {
    return this.sparks.activeCount
  }

  /** Pooled objects created so far across the three pools (high-water mark; for the debug report). */
  get createdCount(): number {
    return this.sparks.createdCount + this.texts.createdCount + this.tints.createdCount
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

    // Once-latch: result-animation-done is emitted exactly once per result, however many paths reach it.
    const latch = createOnceLatch(() => {
      this.finishPending = null
      this.bridge?.emit({ type: 'result-animation-done' })
    })
    const finish = (): void => {
      latch.fire()
    }
    this.finishPending = finish

    const weapons = this.extras.weapons
    const target: StrikeTarget | null = monster
      ? { x: monster.position.x, y: monster.position.y, footY: monster.footY, unit: monster.isBoss ? 1.5 : 1 }
      : null
    const side: -1 | 1 = player && monster && player.x >= monster.position.x ? 1 : -1
    // Hit feel (D22): strong only on a critical hit or the blow that kills the boss. Read from the result.
    const bossKill = result.correct && result.monster_hp_remaining === 0 && monster?.isBoss === true
    const hit = planHit({ critical: result.correct && result.is_critical === true, bossKill, reducedMotion: reduced })
    if (!bossKill) this.extras.bossDeath?.disarm()

    let impact = 0
    if (has('projectile') && player && monster && !reduced) {
      if (weapons && target) {
        // The weapon named by the result (dagger when absent or unknown) strikes the monster.
        impact = weapons.strike(result.weapon_id, target, side)
      } else {
        this.fireProjectile(player, monster)
        impact = PROJECTILE_MS
      }
      sfx.play('attack')
    } else if (has('monster-attack') && player && monster) {
      sfx.play('attack')
      monster.playAttack()
      monster.nudge(player.x < monster.position.x ? (monster.enraged ? -44 : -28) : monster.enraged ? 44 : 28, LUNGE_MS)
      impact = reduced ? 0 : LUNGE_MS
    }

    this.later(impact, () => {
      sfx.play('hit')
      if (has('hit-flash')) monster?.flash()
      if (result.correct) monster?.playHit()
      if (result.correct && monster) {
        // Knockback away from the player, then the strong-hit feel (hit-stop and shake; both 0 when reduced).
        monster.knockback(player && player.x < monster.position.x ? 1 : -1, hit.knockbackPx)
        if (hit.hitStopMs > 0) this.extras.hitStop?.trigger(hit.hitStopMs)
        if (hit.shakeMs > 0) this.scene.cameras.main.shake(hit.shakeMs, hit.shakeIntensity)
      }
      const fb = feedbackPlan(result.correct, reduced)
      if (fb.kind === 'wisp' && monster) this.wispBurst(monster.position.x, monster.position.y - 10, fb)
      if (fb.kind === 'curse') this.curseTint(fb)
      // Reduced_Motion: static markers on the monster (weapon shape, verdict dot) instead of moving bursts.
      if (reduced && monster) {
        if (result.correct && weapons && target) weapons.marker(result.weapon_id, target)
        this.fx?.hitMarker(monster.position.x, monster.position.y - 10, result.correct)
      }
      // Critical hit: pooled white flash at alpha 0.35 (static marker when reduced). Damage is unchanged.
      if (result.correct && result.is_critical === true && weapons && target) weapons.critical(target, reduced)
      if (has('damage-number') && plan.damageText && monster) {
        this.floatText(monster.position.x, monster.position.y - 40, plan.damageText, CSS_COLORS.ACCENT, reduced, hit.popScale)
      }
      if (has('monster-hp') && monster) {
        monster.setHp(result.monster_hp_remaining, true)
        // Boss phase comes only from the HP the backend sent.
        this.extras.boss?.onMonsterHp(monster, result.monster_hp_remaining)
      }
      if (has('player-flash')) player?.flashHit()
      if (has('camera-shake')) this.scene.cameras.main.shake(plan.shakeMs, monster?.enraged ? 0.007 : 0.004)
      if (!result.correct && player) {
        this.floatText(player.x, player.y - 30, 'Ouch!', CSS_COLORS.DANGER, reduced)
      }
    })

    let end = impact + (reduced ? 0 : 320)
    if (has('monster-defeat')) {
      this.later(impact + (reduced ? 0 : 120), () => {
        // The boss killing blow hands over to the boss death sequence (armed by play-boss-death).
        const bossRoom = this.extras.bossDeath?.consumeArmed()
        if (bossRoom && monster) {
          this.extras.bossDeath?.play(bossRoom, monster)
          return
        }
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
    for (const o of this.tints.active()) {
      this.scene.tweens.killTweensOf(o)
      o.setVisible(false)
    }
    this.sparks.releaseAll()
    this.texts.releaseAll()
    this.tints.releaseAll()
  }

  destroy(): void {
    this.cancel()
    this.sparks.clear((o) => o.destroy())
    this.texts.clear((o) => o.destroy())
    this.tints.clear((o) => o.destroy())
  }

  /** Green ghost wisps rising from the monster (correct answer). Pooled sparks. */
  private wispBurst(x: number, y: number, fb: FeedbackPlan): void {
    for (let i = 0; i < fb.wisps; i++) {
      const w = this.acquireSpark()
      if (!w) return
      const dx = (i - (fb.wisps - 1) / 2) * 14
      w.setPosition(x + dx, y)
        .setTint(COLORS.GHOST)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.9)
        .setAlpha(0.85)
        .setDepth(21)
      if (!fb.animated) {
        this.scene.time.delayedCall(500, () => this.sparks.release(w))
        continue
      }
      this.releaseOnComplete(w, {
        x: x + dx * 1.6,
        y: y - 34 - (i % 3) * 8,
        alpha: 0,
        scale: 0.3,
        delay: i * 30,
        duration: 560,
        ease: 'Sine.easeOut',
      })
    }
  }

  /** Purple-red curse tint (wrong answer). A single quick flash, or a static fading tint when reduced. */
  private curseTint(fb: FeedbackPlan): void {
    const r = this.tints.acquire()
    if (!r) return
    const cam = this.scene.cameras.main
    r.setPosition(cam.width / 2, cam.height / 2).setAlpha(fb.tintAlpha)
    this.scene.tweens.add({
      targets: r,
      alpha: 0,
      delay: fb.holdMs,
      duration: fb.fadeMs,
      ease: fb.flash ? 'Quad.easeOut' : 'Linear',
      onComplete: () => {
        r.setVisible(false)
        this.tints.release(r)
      },
    })
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

  /**
   * Floating number. Snappy pop: it jumps to `popScale` in 90 ms (Back ease) and settles, then rises and
   * fades in 450 ms (was 700). Reduced_Motion: static for 600 ms, no scale.
   */
  private floatText(x: number, y: number, text: string, color: string, reduced: boolean, popScale = 1): void {
    const t = this.texts.acquire()
    if (!t) return
    t.setText(text).setColor(color).setPosition(x, y).setDepth(30)
    if (reduced) {
      this.scene.time.delayedCall(600, () => this.texts.release(t))
      return
    }
    if (popScale > 1) {
      t.setScale(0.6)
      this.scene.tweens.add({ targets: t, scale: popScale, duration: 90, ease: 'Back.easeOut' })
      this.scene.tweens.add({ targets: t, scale: 1, delay: 90, duration: 90, ease: 'Sine.easeOut' })
    }
    this.scene.tweens.add({
      targets: t,
      y: y - 34,
      alpha: 0,
      delay: 120,
      duration: 450,
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
