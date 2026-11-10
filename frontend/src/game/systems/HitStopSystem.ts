import type Phaser from 'phaser'

/** Tweens and animations run at this fraction of normal speed during a hit-stop (not zero, so they resume cleanly). */
export const HIT_STOP_SCALE = 0.05
/** A hit-stop never lasts longer than this, however many are requested. */
const MAX_HIT_STOP_MS = 120

/**
 * Hit-stop (D22): freezes tweens and sprite animations for a few ms on a strong hit. It is one reusable slot
 * (two numbers), so triggering it allocates nothing. Scene timers keep running, so combat timing and the
 * result-animation-done fallback are unchanged. The restore is driven by `update`, on the wall clock, so a
 * frozen tween clock cannot hold it. The caller passes ms from `planHit`, which is 0 under Reduced_Motion.
 */
export class HitStopSystem {
  private until = 0
  private frozen = false

  constructor(private readonly scene: Phaser.Scene) {}

  get isFrozen(): boolean {
    return this.frozen
  }

  /** Freeze for `ms` (0 or less does nothing). A request while frozen extends the stop up to the cap. */
  trigger(ms: number): void {
    if (ms <= 0) return
    const end = performance.now() + Math.min(ms, MAX_HIT_STOP_MS)
    if (end > this.until) this.until = end
    if (this.frozen) return
    this.frozen = true
    this.scene.tweens.timeScale = HIT_STOP_SCALE
    this.scene.anims.globalTimeScale = HIT_STOP_SCALE
  }

  /** Call once per frame. Cheap when nothing is frozen. */
  update(): void {
    if (this.frozen && performance.now() >= this.until) this.release()
  }

  /** Back to normal speed at once (room rebuild, shutdown). */
  release(): void {
    if (!this.frozen) return
    this.frozen = false
    this.until = 0
    this.scene.tweens.timeScale = 1
    this.scene.anims.globalTimeScale = 1
  }

  destroy(): void {
    this.release()
  }
}
