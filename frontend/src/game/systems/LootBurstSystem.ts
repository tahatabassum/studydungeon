import Phaser from 'phaser'
import { COLORS } from '../colors'
import { ObjectPool } from './objectPool'
import { ensureSparkTexture } from './sparkTexture'

/** Pooled pieces (coins and soul gems) alive at once. */
export const LOOT_POOL = 24
const LOOT_COUNT = 14
const LOOT_DEPTH = 22
const FLIGHT_MS = 640
const STATIC_MS = 700

/**
 * Coins and soul gems bursting out of a point. Pieces come from a pool of 24 reusable 'spark' images, so
 * a burst creates nothing after the first. Even pieces are gold coins, odd pieces green soul gems. Each
 * piece is one tween (x drifts, y arcs up and back, alpha fades), so there is no per-frame work.
 * Reduced_Motion: a short static ring of pieces instead of the burst.
 */
export class LootBurstSystem {
  private readonly pool: ObjectPool<Phaser.GameObjects.Image>
  private staticTimer: Phaser.Time.TimerEvent | null = null

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly isReduced: () => boolean,
  ) {
    this.pool = new ObjectPool({
      create: () => scene.add.image(0, 0, 'spark').setDepth(LOOT_DEPTH),
      reset: (img) =>
        img
          .clearTint()
          .setScale(1)
          .setAlpha(1)
          .setAngle(0)
          .setBlendMode(Phaser.BlendModes.NORMAL)
          .setVisible(true)
          .setActive(true),
      max: LOOT_POOL,
    })
  }

  get activeCount(): number {
    return this.pool.activeCount
  }

  get createdCount(): number {
    return this.pool.createdCount
  }

  burst(x: number, y: number): void {
    ensureSparkTexture(this.scene)
    const reduced = this.isReduced()
    for (let i = 0; i < LOOT_COUNT; i++) {
      const img = this.pool.acquire()
      if (!img) return
      const gem = i % 2 === 1
      const a = (Math.PI * 2 * i) / LOOT_COUNT
      img.setPosition(x, y).setTint(gem ? COLORS.GHOST : COLORS.ACCENT)
      img.setScale(gem ? 0.5 : 0.6, gem ? 0.75 : 0.6)
      if (reduced) {
        img.setPosition(x + Math.cos(a) * 34, y + Math.sin(a) * 18)
        continue
      }
      // Deterministic spread from the index: no random numbers, so a burst always looks the same.
      const reach = 36 + (i % 4) * 14
      const rise = 26 + (i % 3) * 14
      this.scene.tweens.add({
        targets: img,
        props: {
          x: { value: x + Math.cos(a) * reach, duration: FLIGHT_MS, ease: 'Sine.easeOut' },
          y: { value: y - rise, duration: FLIGHT_MS / 2, yoyo: true, ease: 'Quad.easeOut' },
          alpha: { value: 0, duration: FLIGHT_MS * 0.35, delay: FLIGHT_MS * 0.65 },
        },
        onComplete: () => this.pool.release(img),
      })
    }
    if (reduced) {
      this.staticTimer?.remove(false)
      this.staticTimer = this.scene.time.delayedCall(STATIC_MS, () => {
        this.staticTimer = null
        this.reset()
      })
    }
  }

  /** Drop every piece in flight and return it to the pool. */
  reset(): void {
    this.staticTimer?.remove(false)
    this.staticTimer = null
    for (const o of this.pool.active()) {
      this.scene.tweens.killTweensOf(o)
      o.setVisible(false)
    }
    this.pool.releaseAll()
  }

  destroy(): void {
    this.reset()
    this.pool.clear((o) => o.destroy())
  }
}
