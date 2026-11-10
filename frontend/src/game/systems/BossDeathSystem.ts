import Phaser from 'phaser'
import { sfx } from '@/audio/sfx'
import { COLORS } from '../colors'
import { FLASH_ALPHA_MAX } from '../fx/effectPlan'
import type { GameBridge } from '../events'
import type { Monster } from '../entities/Monster'
import { createOnceLatch } from './onceLatch'
import { ObjectPool } from './objectPool'
import { ensureSparkTexture } from './sparkTexture'

/** Most sparks alive at once (Req 12.2). */
export const BOSS_SPARK_MAX = 60
/** The full sequence and the reduced-motion fade, in ms. */
export const BOSS_DEATH_MS = 900
export const BOSS_DEATH_REDUCED_MS = 200
const SPARKS_FIRST_WAVE = 36
const SHAKE_MS = 260
const SHAKE_INTENSITY = 0.005
const FLASH_MS = 180
const DEPTH = 24
const FLASH_DEPTH = 96
/** The loot bursts this long after the sequence starts. */
const LOOT_AT_MS = 420
/** Extra slack after the dissolve before the done event. */
const TAIL_MS = 40

export interface BossDeathHooks {
  /** The boss monster of a room, if any. */
  monsterOf(roomId: string): Monster | null
  /** Called once when the loot should burst, with the boss position. */
  loot(x: number, y: number): void
}

/**
 * The boss death sequence (D22): a dissolve of the body, a burst of pooled sparks (at most 60), one camera
 * shake and one soft white flash (alpha at most 0.35, no repeats), then `boss-death-done`. It takes about
 * 900 ms. Under Reduced_Motion it is a 200 ms fade with no sparks, shake or flash.
 *
 * React sends `play-boss-death` just before `apply-result` for the killing blow; the scene calls `arm`,
 * which readies the dissolve, and EffectsSystem calls `play` when the blow lands.
 */
export class BossDeathSystem {
  private readonly sparks: ObjectPool<Phaser.GameObjects.Image>
  private readonly flashes: ObjectPool<Phaser.GameObjects.Rectangle>
  private armedRoom: string | null = null
  private timer: Phaser.Time.TimerEvent | null = null
  private lootTimer: Phaser.Time.TimerEvent | null = null

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bridge: GameBridge | undefined,
    private readonly isReduced: () => boolean,
    private readonly hooks: BossDeathHooks,
  ) {
    this.sparks = new ObjectPool({
      create: () => scene.add.image(0, 0, 'spark').setDepth(DEPTH),
      reset: (img) =>
        img
          .clearTint()
          .setScale(1)
          .setAlpha(1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(true)
          .setActive(true),
      max: BOSS_SPARK_MAX,
    })
    this.flashes = new ObjectPool({
      create: () =>
        scene.add.rectangle(0, 0, 4000, 4000, 0xffffff, 1).setScrollFactor(0).setDepth(FLASH_DEPTH).setVisible(false),
      reset: (r) => r.setAlpha(0).setVisible(true).setActive(true),
      max: 1,
    })
  }

  get activeCount(): number {
    return this.sparks.activeCount
  }

  get createdCount(): number {
    return this.sparks.createdCount
  }

  /** Ready the sequence for the room's boss: its next defeat dissolves instead of eroding. */
  arm(roomId: string): void {
    const monster = this.hooks.monsterOf(roomId)
    if (!monster || !monster.isBoss || !monster.alive) return
    this.armedRoom = roomId
    monster.prepareDissolve(this.isReduced() ? BOSS_DEATH_REDUCED_MS : BOSS_DEATH_MS)
  }

  /** Forget a pending arm (the blow did not kill). */
  disarm(): void {
    this.armedRoom = null
  }

  /** True once if armed; the caller then calls `play`. */
  consumeArmed(): string | null {
    const id = this.armedRoom
    this.armedRoom = null
    return id
  }

  /** Run the sequence on the boss and emit `boss-death-done` once at the end. */
  play(roomId: string, monster: Monster): void {
    this.stop()
    const reduced = this.isReduced()
    const ms = reduced ? BOSS_DEATH_REDUCED_MS : BOSS_DEATH_MS
    const latch = createOnceLatch(() => {
      this.bridge?.emit({ type: 'boss-death-done', roomId })
    })
    // The dissolve is the Monster's own (prepared in `arm`); make sure it runs even if arming was missed.
    monster.prepareDissolve(ms)
    monster.playDeath()
    sfx.play('bossfall')
    if (!reduced) {
      const cam = this.scene.cameras.main
      cam.shake(SHAKE_MS, SHAKE_INTENSITY)
      this.flash()
      this.sparkBurst(monster.position.x, monster.position.y - 20)
      this.lootTimer = this.scene.time.delayedCall(LOOT_AT_MS, () => {
        this.lootTimer = null
        this.hooks.loot(monster.position.x, monster.footY - 8)
      })
    }
    this.timer = this.scene.time.delayedCall(ms + TAIL_MS, () => {
      this.timer = null
      latch.fire()
    })
  }

  /** Drop pending work without emitting (room rebuild, shutdown) and return the pooled objects. */
  reset(): void {
    this.stop()
    this.armedRoom = null
  }

  destroy(): void {
    this.reset()
    this.sparks.clear((o) => o.destroy())
    this.flashes.clear((o) => o.destroy())
  }

  private stop(): void {
    this.timer?.remove(false)
    this.timer = null
    this.lootTimer?.remove(false)
    this.lootTimer = null
    for (const o of this.sparks.active()) {
      this.scene.tweens.killTweensOf(o)
      o.setVisible(false)
    }
    this.sparks.releaseAll()
    for (const r of this.flashes.active()) {
      this.scene.tweens.killTweensOf(r)
      r.setVisible(false)
    }
    this.flashes.releaseAll()
  }

  /** One soft white flash: peak alpha at most 0.35, a single fade, never repeated. */
  private flash(): void {
    const r = this.flashes.acquire()
    if (!r) return
    const cam = this.scene.cameras.main
    r.setPosition(cam.width / 2, cam.height / 2).setAlpha(FLASH_ALPHA_MAX)
    this.scene.tweens.add({
      targets: r,
      alpha: 0,
      duration: FLASH_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        r.setVisible(false)
        this.flashes.release(r)
      },
    })
  }

  /**
   * Sparks fly out in a ring (first wave), then embers rise from the dissolving body (second wave). The total
   * never exceeds the pool of 60. Angles come from the index, so the burst is the same every time.
   */
  private sparkBurst(x: number, y: number): void {
    ensureSparkTexture(this.scene)
    for (let i = 0; i < BOSS_SPARK_MAX; i++) {
      const s = this.sparks.acquire()
      if (!s) return
      const first = i < SPARKS_FIRST_WAVE
      if (first) {
        const a = (Math.PI * 2 * i) / SPARKS_FIRST_WAVE
        const reach = 50 + (i % 5) * 16
        s.setPosition(x, y).setTint(i % 3 === 0 ? COLORS.BONE : i % 3 === 1 ? COLORS.MAGIC : COLORS.ACCENT).setScale(0.8)
        this.scene.tweens.add({
          targets: s,
          x: x + Math.cos(a) * reach,
          y: y + Math.sin(a) * reach * 0.7,
          alpha: 0,
          scale: 0.2,
          duration: 520 + (i % 4) * 60,
          ease: 'Cubic.easeOut',
          onComplete: () => this.sparks.release(s),
        })
      } else {
        const k = i - SPARKS_FIRST_WAVE
        const dx = ((k % 8) - 3.5) * 9
        s.setPosition(x + dx, y + 18).setTint(k % 2 === 0 ? COLORS.GHOST : COLORS.MAGIC).setScale(0.55).setAlpha(0.8)
        this.scene.tweens.add({
          targets: s,
          y: y - 46 - (k % 5) * 12,
          alpha: 0,
          scale: 0.15,
          delay: 160 + k * 18,
          duration: 480,
          ease: 'Sine.easeOut',
          onComplete: () => this.sparks.release(s),
        })
      }
    }
  }
}
