import Phaser from 'phaser'
import { COLORS } from '../colors'
import { WEAPON_FX_POOL, weaponFx, type WeaponFxDescriptor } from '../fx/weapons'
import { ObjectPool } from './objectPool'

/** Above the encounter dim (40) and the monster, below the curse tint (95). */
const DEPTH = 48
const FLASH_DEPTH = 96
/** White critical flash peak alpha (Req 7.4). */
export const CRIT_FLASH_ALPHA = 0.35
const CRIT_FLASH_MS = 220
const MARKER_MS = 700
/** Source distance of travelling shots (bolt, arrow) in world px. */
const SHOT_DISTANCE = 150

interface Pt {
  x: number
  y: number
}

/** The strike target: where the weapon lands, in world px, and the size unit (1, or 1.5 for the boss). */
export interface StrikeTarget {
  x: number
  y: number
  footY: number
  unit: number
}

/**
 * Draws the five weapon strikes on the monster from a pool of 16 reusable Graphics objects.
 * Each shape is drawn once when it is acquired; afterwards only transforms are tweened, so nothing
 * is created or redrawn per frame. All shapes use additive blending and bright cores so they still
 * read through the encounter pop-up's 55 percent scrim. Reduced_Motion shows a static marker.
 */
export class WeaponFxSystem {
  private readonly pool: ObjectPool<Phaser.GameObjects.Graphics>
  private readonly flashes: ObjectPool<Phaser.GameObjects.Rectangle>
  private markerTimer: Phaser.Time.TimerEvent | null = null

  constructor(private readonly scene: Phaser.Scene) {
    this.pool = new ObjectPool({
      create: () => scene.add.graphics().setDepth(DEPTH).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
      reset: (g) =>
        g
          .clear()
          .setPosition(0, 0)
          .setScale(1, 1)
          .setRotation(0)
          .setAlpha(1)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(true)
          .setActive(true),
      max: WEAPON_FX_POOL,
    })
    this.flashes = new ObjectPool({
      create: () => scene.add.rectangle(0, 0, 4000, 4000, 0xffffff, 1).setScrollFactor(0).setDepth(FLASH_DEPTH).setVisible(false),
      reset: (r) => r.setAlpha(0).setVisible(true).setActive(true),
      max: 1,
    })
  }

  /** Pooled Graphics currently in use (for the particle-count readout and tests). */
  get activeCount(): number {
    return this.pool.activeCount
  }

  /** Pooled Graphics created so far (high-water mark; for the debug report). */
  get createdCount(): number {
    return this.pool.createdCount + this.flashes.createdCount
  }

  /**
   * Plays the strike for `weaponId` (unknown or absent gives the dagger) on the target.
   * `side` is -1 when the player stands left of the monster, 1 when right; shots come from that side.
   * Returns the delay in ms until the hit lands.
   */
  strike(weaponId: string | undefined, t: StrikeTarget, side: -1 | 1): number {
    this.clear()
    const d = weaponFx(weaponId)
    switch (d.shape) {
      case 'slash':
        this.slash(d, t)
        break
      case 'bolt':
        this.bolt(d, t, side)
        break
      case 'arrow':
        this.arrow(d, t, side)
        break
      case 'shockwave':
        this.shockwave(d, t)
        break
      case 'burst':
        this.burst(d, t)
        break
    }
    return d.impactMs
  }

  /** Reduced_Motion: a static marker of the weapon's shape on the monster; no tweens, no bursts. */
  marker(weaponId: string | undefined, t: StrikeTarget): void {
    this.clear()
    const d = weaponFx(weaponId)
    const u = t.unit
    const g = this.take(t.x, t.y)
    if (!g) return
    switch (d.shape) {
      case 'slash':
        drawSlash(g, d, u)
        g.setRotation(-0.5)
        break
      case 'bolt':
        drawOrb(g, d, u, 0)
        drawRing(g, d.accent, 22 * u, 3)
        break
      case 'arrow':
        drawArrow(g, d, u)
        g.setPosition(t.x - 20 * u, t.y)
        break
      case 'shockwave':
        g.setPosition(t.x, t.footY - 8)
        drawRing(g, d.color, 40 * u, 5)
        drawRing(g, d.accent, 40 * u, 2)
        g.setScale(1, 0.4)
        break
      case 'burst':
        g.setPosition(t.x, t.footY - 6)
        drawSigil(g, d, u)
        g.setScale(1, 0.45)
        drawFlame(this.take(t.x, t.y - 6 * u), d, u)
        break
    }
    this.armMarkerTimer()
  }

  /**
   * Critical hit: a pooled white flash at alpha 0.35 with a quick star pop on the monster.
   * Under Reduced_Motion: a static star marker instead of the flash.
   */
  critical(t: StrikeTarget, reduced: boolean): void {
    const star = this.take(t.x, t.y - 4 * t.unit)
    if (star) drawStar(star, COLORS.BONE, 30 * t.unit)
    if (reduced) {
      if (star) this.armMarkerTimer()
      return
    }
    if (star) {
      star.setScale(0.4)
      this.play(star, { scale: 1.7, alpha: 0 }, 320, 0, 'Cubic.easeOut')
    }
    const r = this.flashes.acquire()
    if (!r) return
    const cam = this.scene.cameras.main
    r.setPosition(cam.width / 2, cam.height / 2).setAlpha(CRIT_FLASH_ALPHA)
    this.scene.tweens.add({
      targets: r,
      alpha: 0,
      duration: CRIT_FLASH_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        r.setVisible(false)
        this.flashes.release(r)
      },
    })
  }

  /** Drop every in-flight visual and return the pooled objects (room rebuild / reset). */
  reset(): void {
    this.clear()
    for (const r of this.flashes.active()) {
      this.scene.tweens.killTweensOf(r)
      r.setVisible(false)
    }
    this.flashes.releaseAll()
  }

  destroy(): void {
    this.reset()
    this.pool.clear((o) => o.destroy())
    this.flashes.clear((o) => o.destroy())
  }

  // ----- shapes -----

  private slash(d: WeaponFxDescriptor, t: StrikeTarget): void {
    const u = t.unit
    const angles = [-0.55, 0.5]
    for (let i = 0; i < 2; i++) {
      const g = this.take(t.x, t.y)
      if (!g) return
      drawSlash(g, d, u)
      g.setRotation(angles[i]).setScale(0.35, 1)
      this.play(g, { scaleX: 1.15, rotation: angles[i] + (i === 0 ? 0.35 : -0.3), alpha: 0 }, 240, i * 70, 'Cubic.easeOut')
    }
    this.glow(t.x, t.y, d.color, 1.1 * u, d.impactMs, 240)
  }

  private bolt(d: WeaponFxDescriptor, t: StrikeTarget, side: -1 | 1): void {
    const u = t.unit
    const travel = -side
    const g = this.take(t.x + side * SHOT_DISTANCE, t.y - 8)
    if (g) {
      drawOrb(g, d, u, travel)
      this.play(g, { x: t.x, y: t.y - 4 }, d.impactMs, 0, 'Quad.easeIn')
    }
    const ring = this.take(t.x, t.y)
    if (ring) {
      drawRing(ring, d.color, 16 * u, 6, 0.6)
      drawRing(ring, d.accent, 16 * u, 3)
      ring.setScale(0.3)
      this.play(ring, { scale: 2.6, alpha: 0 }, 380, d.impactMs, 'Cubic.easeOut')
    }
    this.glow(t.x, t.y, d.color, 1.4 * u, d.impactMs, 320)
  }

  private arrow(d: WeaponFxDescriptor, t: StrikeTarget, side: -1 | 1): void {
    const u = t.unit
    const travel = -side
    const g = this.take(t.x + side * SHOT_DISTANCE, t.y - 6)
    if (g) {
      drawArrow(g, d, u)
      g.setScale(travel, 1)
      this.play(g, { x: t.x - travel * 8, y: t.y - 4, alpha: 0.95 }, d.impactMs, 0, 'Quad.easeIn')
    }
    const star = this.take(t.x, t.y - 4)
    if (star) {
      drawSpikes(star, d.accent, d.color, 20 * u, 6)
      star.setScale(0.3)
      this.play(star, { scale: 1.5, alpha: 0 }, 300, d.impactMs, 'Cubic.easeOut')
    }
    this.glow(t.x, t.y, d.color, 1 * u, d.impactMs, 260)
  }

  private shockwave(d: WeaponFxDescriptor, t: StrikeTarget): void {
    const u = t.unit
    const y = t.footY - 8
    for (let i = 0; i < 2; i++) {
      const ring = this.take(t.x, y)
      if (!ring) return
      drawRing(ring, i === 0 ? d.color : d.accent, 28 * u, i === 0 ? 8 : 4, i === 0 ? 0.7 : 1)
      drawRing(ring, d.accent, 28 * u, 2)
      ring.setScale(0.25, 0.1)
      this.play(ring, { scaleX: 2.6, scaleY: 0.95, alpha: 0 }, 460, d.impactMs + i * 110, 'Cubic.easeOut')
    }
    const cracks = this.take(t.x, y)
    if (cracks) {
      drawSpikes(cracks, d.accent, d.color, 52 * u, 9)
      cracks.setScale(0.5, 0.2)
      this.play(cracks, { scaleX: 1.3, scaleY: 0.5, alpha: 0 }, 520, d.impactMs, 'Sine.easeOut')
    }
    this.glow(t.x, t.y, d.color, 1.5 * u, d.impactMs, 340)
    this.scene.cameras.main.shake(90, 0.003)
  }

  private burst(d: WeaponFxDescriptor, t: StrikeTarget): void {
    const u = t.unit
    const sigil = this.take(t.x, t.footY - 6)
    if (sigil) {
      drawSigil(sigil, d, u)
      sigil.setScale(0.6, 0.27)
      this.play(sigil, { scaleX: 1.2, scaleY: 0.54, alpha: 0 }, d.durationMs, 0, 'Sine.easeOut')
    }
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6
      const fx = t.x + Math.cos(a) * 30 * u
      const fy = t.footY - 10 + Math.sin(a) * 12 * u
      const f = this.take(fx, fy)
      if (!f) break
      drawFlame(f, d, u)
      f.setScale(0.4)
      this.play(f, { y: fy - 46 * u, scale: 1.25, alpha: 0 }, 420, d.impactMs - 40 + i * 45, 'Sine.easeOut')
    }
    this.glow(t.x, t.y, d.color, 1.8 * u, d.impactMs, 380)
  }

  /** A soft additive flash at the impact point. */
  private glow(x: number, y: number, color: number, size: number, delay: number, ms: number): void {
    const g = this.take(x, y)
    if (!g) return
    g.fillStyle(color, 0.28).fillCircle(0, 0, 34)
    g.fillStyle(color, 0.5).fillCircle(0, 0, 22)
    g.fillStyle(COLORS.BONE, 0.9).fillCircle(0, 0, 9)
    g.setScale(0.35 * size)
    this.play(g, { scale: 1.3 * size, alpha: 0 }, ms, delay, 'Cubic.easeOut')
  }

  // ----- pool helpers -----

  private take(x: number, y: number): Phaser.GameObjects.Graphics | null {
    const g = this.pool.acquire()
    return g ? g.setPosition(x, y) : null
  }

  /** Tween transforms of a pooled Graphics, hidden until its delay elapses, released when done. */
  private play(g: Phaser.GameObjects.Graphics, props: Record<string, unknown>, ms: number, delay: number, ease: string): void {
    if (delay > 0) g.setVisible(false)
    this.scene.tweens.add({
      targets: g,
      ...props,
      duration: ms,
      delay,
      ease,
      onStart: () => g.setVisible(true),
      onComplete: () => this.release(g),
    })
  }

  private release(g: Phaser.GameObjects.Graphics): void {
    this.scene.tweens.killTweensOf(g)
    g.setVisible(false)
    this.pool.release(g)
  }

  private armMarkerTimer(): void {
    this.markerTimer?.remove(false)
    this.markerTimer = this.scene.time.delayedCall(MARKER_MS, () => {
      this.markerTimer = null
      this.clear()
    })
  }

  private clear(): void {
    this.markerTimer?.remove(false)
    this.markerTimer = null
    for (const g of this.pool.active()) this.release(g)
  }
}

// ----- pure drawing (once per acquire; local coordinates around (0, 0)) -----

/** A tapered crescent: wide ember glow, bright mid stroke, white-hot core. */
function drawSlash(g: Phaser.GameObjects.Graphics, d: WeaponFxDescriptor, u: number): void {
  const len = 52 * u
  const n = 14
  const pts: Pt[] = []
  const left: Pt[] = []
  const right: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const s = i / n
    pts.push({ x: (s * 2 - 1) * len, y: (s * 2 - 1) * len * 0.7 - Math.sin(Math.PI * s) * len * 0.3 })
  }
  const layers: Array<[number, number, number]> = [
    [11 * u, d.color, 0.55],
    [7 * u, d.color, 1],
    [3.5 * u, d.accent, 1],
  ]
  for (const [w, color, alpha] of layers) {
    left.length = 0
    right.length = 0
    for (let i = 0; i <= n; i++) {
      const a = pts[Math.max(0, i - 1)]
      const b = pts[Math.min(n, i + 1)]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const m = Math.hypot(dx, dy) || 1
      const taper = (w * Math.sin((Math.PI * i) / n)) / 2
      left.push({ x: pts[i].x - (dy / m) * taper, y: pts[i].y + (dx / m) * taper })
      right.push({ x: pts[i].x + (dy / m) * taper, y: pts[i].y - (dx / m) * taper })
    }
    right.reverse()
    g.fillStyle(color, alpha)
    g.fillPoints([...left, ...right], true)
  }
}

/** Violet orb with a comet tail trailing behind it (the shot travels toward +x * travel). */
function drawOrb(g: Phaser.GameObjects.Graphics, d: WeaponFxDescriptor, u: number, travel: number): void {
  const dir = travel === 0 ? -1 : -travel
  for (let i = 1; i <= 5; i++) {
    g.fillStyle(d.color, 0.5 - i * 0.07).fillCircle(dir * i * 9 * u, 0, (14 - i * 1.6) * u)
  }
  g.fillStyle(d.color, 0.35).fillCircle(0, 0, 20 * u)
  g.fillStyle(COLORS.MAGENTA, 0.7).fillCircle(0, 0, 13 * u)
  g.fillStyle(d.accent, 1).fillCircle(0, 0, 6.5 * u)
}

/** Crossbow bolt pointing +x with a glowing streak behind it. */
function drawArrow(g: Phaser.GameObjects.Graphics, d: WeaponFxDescriptor, u: number): void {
  g.fillStyle(d.color, 0.45)
  g.fillTriangle(-80 * u, 0, -8 * u, -5 * u, -8 * u, 5 * u)
  g.lineStyle(4 * u, d.color, 1).lineBetween(-30 * u, 0, 12 * u, 0)
  g.lineStyle(2 * u, d.accent, 1).lineBetween(-30 * u, 0, 12 * u, 0)
  g.fillStyle(d.accent, 1).fillTriangle(10 * u, -7 * u, 10 * u, 7 * u, 26 * u, 0)
  g.fillStyle(d.color, 1)
  g.fillTriangle(-30 * u, 0, -38 * u, -7 * u, -24 * u, -2 * u)
  g.fillTriangle(-30 * u, 0, -38 * u, 7 * u, -24 * u, 2 * u)
}

function drawRing(g: Phaser.GameObjects.Graphics, color: number, r: number, width: number, alpha = 1): void {
  g.lineStyle(width, color, alpha).strokeCircle(0, 0, r)
}

/** Radial spikes (impact star, ground cracks): a thick colour pass under a thin bright pass. */
function drawSpikes(g: Phaser.GameObjects.Graphics, core: number, color: number, r: number, count: number): void {
  for (let pass = 0; pass < 2; pass++) {
    g.lineStyle(pass === 0 ? 5 : 2, pass === 0 ? color : core, pass === 0 ? 0.7 : 1)
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (i % 2) * 0.15
      const len = r * (i % 2 === 0 ? 1 : 0.6)
      g.lineBetween(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2, Math.cos(a) * len, Math.sin(a) * len)
    }
  }
}

/** The critical-hit star: a bright four-point flare. */
function drawStar(g: Phaser.GameObjects.Graphics, color: number, r: number): void {
  g.fillStyle(color, 0.9)
  g.fillTriangle(0, -r, -r * 0.16, 0, r * 0.16, 0)
  g.fillTriangle(0, r, -r * 0.16, 0, r * 0.16, 0)
  g.fillTriangle(-r, 0, 0, -r * 0.16, 0, r * 0.16)
  g.fillTriangle(r, 0, 0, -r * 0.16, 0, r * 0.16)
  g.fillStyle(0xffffff, 1).fillCircle(0, 0, r * 0.18)
}

/** Flame sigil circle: two rings and an eight-point star on the floor. */
function drawSigil(g: Phaser.GameObjects.Graphics, d: WeaponFxDescriptor, u: number): void {
  const r = 38 * u
  g.lineStyle(5, d.color, 0.55).strokeCircle(0, 0, r)
  g.lineStyle(2, d.accent, 1).strokeCircle(0, 0, r)
  g.lineStyle(2, d.color, 1).strokeCircle(0, 0, r * 0.62)
  g.lineStyle(2, d.accent, 1)
  const n = 8
  for (let i = 0; i < n; i++) {
    const a1 = (Math.PI * 2 * i) / n
    const a2 = (Math.PI * 2 * ((i + 3) % n)) / n
    g.lineBetween(Math.cos(a1) * r, Math.sin(a1) * r, Math.cos(a2) * r, Math.sin(a2) * r)
  }
}

/** A flame tongue: orange teardrop with a golden heart. */
function drawFlame(g: Phaser.GameObjects.Graphics | null, d: WeaponFxDescriptor, u: number): void {
  if (!g) return
  g.fillStyle(d.color, 0.9)
  g.fillTriangle(0, -26 * u, -10 * u, 4 * u, 10 * u, 4 * u)
  g.fillCircle(0, 5 * u, 10 * u)
  g.fillStyle(COLORS.DANGER, 0.6).fillCircle(0, 7 * u, 7 * u)
  g.fillStyle(d.accent, 1)
  g.fillTriangle(0, -14 * u, -5 * u, 4 * u, 5 * u, 4 * u)
  g.fillCircle(0, 5 * u, 5 * u)
}
