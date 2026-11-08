import Phaser from 'phaser'
import { COLORS } from '../colors'
import { ObjectPool } from './objectPool'
import { ensureSparkTexture } from './sparkTexture'

const DIM_DEPTH = 40
const DIM_ALPHA = 0.18
const DIM_MS = 200
const MARKER_MS = 600

/**
 * Display-only encounter feedback in Phaser: a light dim acknowledging the pop-up
 * (the React scrim does the heavy dimming) and a static hit marker under Reduced_Motion.
 * Both objects come from pools of one; nothing is allocated per frame or per result.
 * The wisp burst, curse flash and strike live in EffectsSystem and share its pooled sparks.
 */
export class EncounterFxSystem {
  private readonly dims: ObjectPool<Phaser.GameObjects.Rectangle>
  private readonly markers: ObjectPool<Phaser.GameObjects.Image>
  private dim: Phaser.GameObjects.Rectangle | null = null
  private markerTimer: Phaser.Time.TimerEvent | null = null

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly isReduced: () => boolean,
  ) {
    this.dims = new ObjectPool({
      create: () => scene.add.rectangle(0, 0, 4000, 4000, COLORS.BG, 1).setScrollFactor(0).setDepth(DIM_DEPTH),
      reset: (r) => r.setAlpha(0).setVisible(true).setActive(true),
      max: 1,
    })
    this.markers = new ObjectPool({
      create: () => {
        ensureSparkTexture(scene)
        return scene.add.image(0, 0, 'spark')
      },
      reset: (m) => m.clearTint().setScale(1).setAlpha(1).setVisible(true).setActive(true),
      max: 1,
    })
  }

  /** The pop-up opened: ease in a light dim over the stage. */
  open(): void {
    if (this.dim) return
    const r = this.dims.acquire()
    if (!r) return
    this.dim = r
    const cam = this.scene.cameras.main
    r.setPosition(cam.width / 2, cam.height / 2)
    this.scene.tweens.killTweensOf(r)
    if (this.isReduced()) {
      r.setAlpha(DIM_ALPHA)
      return
    }
    this.scene.tweens.add({ targets: r, alpha: DIM_ALPHA, duration: DIM_MS, ease: 'Sine.easeOut' })
  }

  /** The pop-up closed: fade the dim out and hand it back to the pool. */
  close(): void {
    const r = this.dim
    if (!r) return
    this.dim = null
    this.scene.tweens.killTweensOf(r)
    const release = (): void => {
      r.setVisible(false)
      this.dims.release(r)
    }
    if (this.isReduced()) {
      release()
      return
    }
    this.scene.tweens.add({ targets: r, alpha: 0, duration: DIM_MS, ease: 'Sine.easeIn', onComplete: release })
  }

  /** A static marker on the monster (Reduced_Motion replacement for bursts). Colour shows the verdict. */
  hitMarker(x: number, y: number, correct: boolean): void {
    this.clearMarker()
    const m = this.markers.acquire()
    if (!m) return
    m.setPosition(x, y).setTint(correct ? COLORS.GHOST : COLORS.DANGER).setScale(1.6).setDepth(DIM_DEPTH + 5)
    this.markerTimer = this.scene.time.delayedCall(MARKER_MS, () => this.clearMarker())
  }

  private clearMarker(): void {
    this.markerTimer?.remove(false)
    this.markerTimer = null
    for (const m of this.markers.active()) {
      m.setVisible(false)
      this.markers.release(m)
    }
  }

  /** Drop in-flight visuals (room rebuild / reset). */
  reset(): void {
    this.clearMarker()
    for (const r of this.dims.active()) {
      this.scene.tweens.killTweensOf(r)
      r.setVisible(false)
    }
    this.dims.releaseAll()
    this.dim = null
  }

  destroy(): void {
    this.clearMarker()
    this.dims.clear((o) => o.destroy())
    this.markers.clear((o) => o.destroy())
    this.dim = null
  }
}
