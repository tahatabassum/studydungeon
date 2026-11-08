import Phaser from 'phaser'
import { COLORS } from '../colors'
import { FOG_BLOB_KEY } from '../textures/registerGlow'
import { ObjectPool } from './objectPool'
import { MIST_BLOBS, transitionPlan } from './transition'
import type { Rect } from '../viewport'

/**
 * Mist wipe between rooms: pooled fog blobs sweep up the screen in at most 600 ms.
 * Any key or pointer press ends it at once. Does nothing under reduced motion.
 */
export class TransitionSystem {
  private readonly blobs: ObjectPool<Phaser.GameObjects.Image>
  private active = false
  private screenRect: Rect = { x: 0, y: 0, w: 960, h: 540 }
  private safety: Phaser.Time.TimerEvent | null = null

  private readonly skip = (): void => this.end()

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly isReduced: () => boolean,
  ) {
    this.blobs = new ObjectPool({
      create: () =>
        scene.add
          .image(0, 0, FOG_BLOB_KEY)
          .setScrollFactor(0)
          .setDepth(96)
          .setTint(COLORS.INDIGO)
          .setScale(4, 5),
      reset: (img) => img.setAlpha(0).setVisible(true).setActive(true),
      max: MIST_BLOBS,
    })
  }

  /** Screen-space rect covering the viewport at the current zoom (set on resize). */
  setScreenRect(r: Rect): void {
    this.screenRect = r
  }

  get playing(): boolean {
    return this.active
  }

  play(): void {
    const plan = transitionPlan(this.isReduced())
    if (!plan || !this.scene.textures.exists(FOG_BLOB_KEY)) return
    this.end()
    this.active = true
    // Screen-space rect (already adjusted for camera zoom) so the wipe spans the whole viewport.
    const r = this.screenRect
    const z = this.scene.cameras.main.zoom || 1
    let remaining = 0
    for (let i = 0; i < plan.blobs; i++) {
      const b = this.blobs.acquire()
      if (!b) break
      remaining++
      const x = r.x + (r.w * i) / (plan.blobs - 1)
      b.setScale(4 / z, 5 / z)
      b.setPosition(x, r.y + r.h + 160 / z)
      this.scene.tweens.add({
        targets: b,
        y: r.y - 160 / z,
        delay: plan.delayMs(i),
        duration: plan.sweepMs,
        ease: 'Sine.easeInOut',
        onUpdate: (tw) => {
          // Fade in then out across the sweep.
          const p = tw.progress
          b.setAlpha(0.9 * Math.sin(Math.PI * p))
        },
        onComplete: () => {
          this.blobs.release(b)
          b.setVisible(false)
          remaining--
          if (remaining <= 0) this.end()
        },
      })
    }
    if (remaining === 0) {
      this.active = false
      return
    }
    this.scene.input.keyboard?.on('keydown', this.skip)
    this.scene.input.on('pointerdown', this.skip)
    this.safety = this.scene.time.delayedCall(plan.totalMs + 40, () => this.end())
  }

  /** Ends the transition immediately and returns the blobs to the pool. */
  end(): void {
    this.scene.input.keyboard?.off('keydown', this.skip)
    this.scene.input.off('pointerdown', this.skip)
    this.safety?.remove(false)
    this.safety = null
    if (!this.active) return
    this.active = false
    for (const b of this.blobs.active()) {
      this.scene.tweens.killTweensOf(b)
      b.setVisible(false)
    }
    this.blobs.releaseAll()
  }

  destroy(): void {
    this.end()
    this.blobs.clear((b) => b.destroy())
  }
}
